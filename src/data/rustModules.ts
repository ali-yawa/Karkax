export interface RustModuleDoc {
  id: 'cargo' | 'quic' | 'input' | 'lib';
  filename: string;
  summary: string;
  code: string;
}

export const RUST_MODULES: RustModuleDoc[] = [
  {
    id: 'cargo',
    filename: 'src-tauri/Cargo.toml',
    summary: 'QUIC (quinn + rustls + rcgen) & Input (enigo + rdev) dependencies',
    code: `[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
mdns-sd = "0.22"
hostname = "0.4"
uuid = { version = "1", features = ["v4"] }

# Step 2: QUIC Encrypted Pairing & Transport
quinn = "0.11"
rustls = { version = "0.23", default-features = false, features = ["ring", "std"] }
rcgen = "0.13"
sha2 = "0.10"
hmac = "0.12"
hex = "0.4"
bincode = "1.3"

# Step 3: Cross-platform Mouse / Keyboard Bridge
enigo = "0.3"
rdev = "0.5"`,
  },
  {
    id: 'quic',
    filename: 'src-tauri/src/quic.rs',
    summary: 'UDP 24800 QUIC TLS 1.3 endpoint, rcgen cert fingerprint & 6-digit PIN HMAC pairing',
    code: `use hmac::{Hmac, Mac};
use quinn::{ClientConfig, Endpoint, ServerConfig};
use rcgen::generate_simple_self_signed;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

type HmacSha256 = Hmac<Sha256>;
const KARKAX_ALPN: &[u8] = b"karkax/1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairRequest {
    pub sender_id: String,
    pub sender_name: String,
    pub nonce: [u8; 16],
    pub pin_hmac_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairResponse {
    pub accepted: bool,
    pub peer_fingerprint: String,
    pub reason: Option<String>,
}

pub struct QuicNode {
    pub endpoint: Endpoint,
    pub local_fingerprint: String,
    pub trusted_peers: Arc<RwLock<HashMap<String, String>>>,
}

pub fn cert_fingerprint_sha256(cert_der: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(cert_der);
    hex::encode(hasher.finalize())
}

pub fn compute_pin_hmac(pin: &str, nonce: &[u8; 16], cert_fp: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(pin.as_bytes()).expect("HMAC key");
    mac.update(nonce);
    mac.update(cert_fp.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

pub fn create_local_identity() -> Result<(CertificateDer<'static>, PrivateKeyDer<'static>, String), String> {
    let cert = generate_simple_self_signed(vec!["karkax.local".to_string()])
        .map_err(|e| format!("rcgen error: {e}"))?;
    let cert_der = cert.cert.der().clone();
    let key_der = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(cert.key_pair.serialize_der()));
    let fp = cert_fingerprint_sha256(cert_der.as_ref());
    Ok((cert_der, key_der, fp))
}

#[derive(Debug)]
struct TofuCertVerifier {
    expected_fp: Option<String>,
}

impl rustls::client::danger::ServerCertVerifier for TofuCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        if let Some(expected) = &self.expected_fp {
            let actual = cert_fingerprint_sha256(end_entity.as_ref());
            if &actual != expected {
                return Err(rustls::Error::General("Certificate fingerprint mismatch".into()));
            }
        }
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::ED25519,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
        ]
    }
}

pub async fn start_quic_server(
    app: AppHandle,
    port: u16,
    active_pin: Arc<RwLock<String>>,
) -> Result<Arc<QuicNode>, String> {
    let (cert, key, local_fp) = create_local_identity()?;

    let mut tls_server = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert], key)
        .map_err(|e| format!("TLS server config: {e}"))?;
    tls_server.alpn_protocols = vec![KARKAX_ALPN.to_vec()];

    let server_config = ServerConfig::with_crypto(Arc::new(
        quinn::crypto::rustls::QuicServerConfig::try_from(tls_server)
            .map_err(|e| format!("QUIC server config: {e}"))?,
    ));

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().unwrap();
    let endpoint = Endpoint::server(server_config, addr).map_err(|e| format!("Bind UDP {port}: {e}"))?;

    let node = Arc::new(QuicNode {
        endpoint: endpoint.clone(),
        local_fingerprint: local_fp.clone(),
        trusted_peers: Arc::new(RwLock::new(HashMap::new())),
    });

    let node_clone = node.clone();
    tokio::spawn(async move {
        while let Some(incoming) = node_clone.endpoint.accept().await {
            let app_ref = app.clone();
            let pin_ref = active_pin.clone();
            let peers_ref = node_clone.trusted_peers.clone();
            let fp_ref = node_clone.local_fingerprint.clone();

            tokio::spawn(async move {
                if let Ok(conn) = incoming.await {
                    if let Ok((mut send, mut recv)) = conn.accept_bi().await {
                        if let Ok(bytes) = recv.read_to_end(8192).await {
                            if let Ok(req) = bincode::deserialize::<PairRequest>(&bytes) {
                                let current_pin = pin_ref.read().unwrap().clone();
                                let expected = compute_pin_hmac(&current_pin, &req.nonce, &fp_ref);
                                let accepted = expected == req.pin_hmac_hex;

                                if accepted {
                                    peers_ref.write().unwrap().insert(req.sender_id.clone(), req.sender_name.clone());
                                    let _ = app_ref.emit("karkax://peer-paired", req.sender_id);
                                }

                                let resp = PairResponse {
                                    accepted,
                                    peer_fingerprint: fp_ref,
                                    reason: if accepted { None } else { Some("Invalid PIN".into()) },
                                };
                                let payload = bincode::serialize(&resp).unwrap_or_default();
                                let _ = send.write_all(&payload).await;
                                let _ = send.finish();
                            }
                        }
                    }
                }
            });
        }
    });

    Ok(node)
}

pub async fn pair_with_peer(
    endpoint: &Endpoint,
    addr: SocketAddr,
    local_id: &str,
    local_name: &str,
    pin: &str,
) -> Result<PairResponse, String> {
    let mut tls_client = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(TofuCertVerifier { expected_fp: None }))
        .with_no_client_auth();
    tls_client.alpn_protocols = vec![KARKAX_ALPN.to_vec()];

    let client_cfg = ClientConfig::new(Arc::new(
        quinn::crypto::rustls::QuicClientConfig::try_from(tls_client)
            .map_err(|e| format!("QUIC client cfg: {e}"))?,
    ));

    let conn = endpoint
        .connect_with(client_cfg, addr, "karkax.local")
        .map_err(|e| format!("QUIC connect: {e}"))?
        .await
        .map_err(|e| format!("QUIC handshake: {e}"))?;

    let peer_certs = conn
        .peer_identity()
        .and_then(|id| id.downcast::<Vec<CertificateDer<'static>>>().ok())
        .ok_or("Missing peer certificate")?;
    let peer_fp = cert_fingerprint_sha256(peer_certs[0].as_ref());

    let nonce: [u8; 16] = rand::random();
    let req = PairRequest {
        sender_id: local_id.to_string(),
        sender_name: local_name.to_string(),
        nonce,
        pin_hmac_hex: compute_pin_hmac(pin, &nonce, &peer_fp),
    };

    let (mut send, mut recv) = conn.open_bi().await.map_err(|e| format!("Stream open: {e}"))?;
    let encoded = bincode::serialize(&req).map_err(|e| format!("Encode: {e}"))?;
    send.write_all(&encoded).await.map_err(|e| format!("Write: {e}"))?;
    send.finish().map_err(|e| format!("Finish: {e}"))?;

    let resp_bytes = recv.read_to_end(4096).await.map_err(|e| format!("Read: {e}"))?;
    let resp: PairResponse = bincode::deserialize(&resp_bytes).map_err(|e| format!("Decode: {e}"))?;
    Ok(resp)
}`,
  },
  {
    id: 'input',
    filename: 'src-tauri/src/input.rs',
    summary: 'Binary input frame protocol, enigo OS injection & edge-crossing router',
    code: `use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InputFrame {
    MouseMoveRel { dx: i32, dy: i32 },
    MouseButton { button: u8, pressed: bool },
    MouseWheel { dx: i32, dy: i32 },
    KeyEvent { key_code: u32, pressed: bool },
    ClipboardText { utf8: String },
    ControlRelease,
}

pub struct InputInjector {
    enigo: Enigo,
}

impl InputInjector {
    pub fn new() -> Result<Self, String> {
        let enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Enigo init failed (check Accessibility permissions): {e:?}"))?;
        Ok(Self { enigo })
    }

    pub fn apply(&mut self, frame: InputFrame) -> Result<(), String> {
        match frame {
            InputFrame::MouseMoveRel { dx, dy } => {
                self.enigo
                    .move_mouse(dx, dy, Coordinate::Rel)
                    .map_err(|e| format!("move_mouse: {e:?}"))?;
            }
            InputFrame::MouseButton { button, pressed } => {
                let btn = match button {
                    0 => Button::Left,
                    1 => Button::Right,
                    _ => Button::Middle,
                };
                let dir = if pressed { Direction::Press } else { Direction::Release };
                self.enigo.button(btn, dir).map_err(|e| format!("button: {e:?}"))?;
            }
            InputFrame::MouseWheel { dx, dy } => {
                if dy != 0 {
                    let _ = self.enigo.scroll(dy, enigo::Axis::Vertical);
                }
                if dx != 0 {
                    let _ = self.enigo.scroll(dx, enigo::Axis::Horizontal);
                }
            }
            InputFrame::KeyEvent { key_code, pressed } => {
                let dir = if pressed { Direction::Press } else { Direction::Release };
                // Map OS-independent HID / Unicode key codes to Enigo Key
                if let Some(ch) = char::from_u32(key_code) {
                    let _ = self.enigo.key(Key::Unicode(ch), dir);
                }
            }
            InputFrame::ClipboardText { utf8: _ } => {
                // Route into arboard / tauri-plugin-clipboard-manager
            }
            InputFrame::ControlRelease => {}
        }
        Ok(())
    }
}

/// Global input capture bridge (host -> remote over QUIC unidirectional stream)
/// - macOS: CGEventTap (requires Accessibility permission)
/// - Windows: SetWindowsHookExW(WH_MOUSE_LL / WH_KEYBOARD_LL)
/// - Linux: rdev / libei (Wayland) or XRecord (X11)
pub fn spawn_capture_loop(
    capturing_remote: Arc<AtomicBool>,
    tx: tokio::sync::mpsc::UnboundedSender<InputFrame>,
) {
    std::thread::spawn(move || {
        let _ = rdev::listen(move |event| {
            if !capturing_remote.load(Ordering::Relaxed) {
                return;
            }
            match event.event_type {
                rdev::EventType::Wheel { delta_x, delta_y } => {
                    let _ = tx.send(InputFrame::MouseWheel {
                        dx: delta_x as i32,
                        dy: delta_y as i32,
                    });
                }
                rdev::EventType::ButtonPress(b) => {
                    let code = match b {
                        rdev::Button::Left => 0,
                        rdev::Button::Right => 1,
                        _ => 2,
                    };
                    let _ = tx.send(InputFrame::MouseButton { button: code, pressed: true });
                }
                rdev::EventType::ButtonRelease(b) => {
                    let code = match b {
                        rdev::Button::Left => 0,
                        rdev::Button::Right => 1,
                        _ => 2,
                    };
                    let _ = tx.send(InputFrame::MouseButton { button: code, pressed: false });
                }
                _ => {}
            }
        });
    });
}`,
  },
  {
    id: 'lib',
    filename: 'src-tauri/src/lib.rs',
    summary: 'Tauri v2 command handlers connecting mDNS discovery, QUIC pairing & input bridge',
    code: `mod discovery;
mod input;
mod quic;

use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, State};
use tokio::sync::OnceCell;
use uuid::Uuid;

pub struct KarkaxState {
    pub local_id: String,
    pub discovery_started: AtomicBool,
    pub active_pin: Arc<RwLock<String>>,
    pub quic_node: OnceCell<Arc<quic::QuicNode>>,
}

fn generate_6_digit_pin() -> String {
    let n: u32 = rand::random::<u32>() % 900_000 + 100_000;
    n.to_string()
}

#[tauri::command]
fn get_local_info(state: State<'_, KarkaxState>) -> serde_json::Value {
    let name = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "Karkax-PC".to_string());

    serde_json::json!({
        "id": state.local_id,
        "name": name,
        "os": std::env::consts::OS,
        "pin": *state.active_pin.read().unwrap()
    })
}

#[tauri::command]
async fn start_discovery(app: AppHandle, state: State<'_, KarkaxState>) -> Result<bool, String> {
    if state.discovery_started.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
        discovery::start_mdns_service(app.clone(), state.local_id.clone(), 24800)?;
        let node = quic::start_quic_server(app, 24800, state.active_pin.clone()).await?;
        let _ = state.quic_node.set(node);
    }
    Ok(true)
}

#[tauri::command]
async fn pair_device(
    state: State<'_, KarkaxState>,
    ip: String,
    port: u16,
    pin: String,
) -> Result<quic::PairResponse, String> {
    let node = state.quic_node.get().ok_or("QUIC server not started")?;
    let addr: SocketAddr = format!("{ip}:{port}").parse().map_err(|e| format!("Bad addr: {e}"))?;
    let name = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "Karkax-PC".to_string());

    quic::pair_with_peer(&node.endpoint, addr, &state.local_id, &name, &pin).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = KarkaxState {
        local_id: Uuid::new_v4().to_string(),
        discovery_started: AtomicBool::new(false),
        active_pin: Arc::new(RwLock::new(generate_6_digit_pin())),
        quic_node: OnceCell::new(),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_local_info,
            start_discovery,
            pair_device
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Karkax");
}`,
  },
];
