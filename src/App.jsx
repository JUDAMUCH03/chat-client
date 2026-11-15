import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";

export const SERVER = "http://localhost:8080";
const WS_URL = "ws://localhost:8080/ws";

const AGENTES = [
  { nombre: "Jett", rol: "Duelista", color: "#38BDF8" },
  { nombre: "Reyna", rol: "Duelista", color: "#C084FC" },
  { nombre: "Phoenix", rol: "Duelista", color: "#FB923C" },
  { nombre: "Sova", rol: "Iniciador", color: "#60A5FA" },
  { nombre: "Omen", rol: "Controlador", color: "#818CF8" },
  { nombre: "Viper", rol: "Controlador", color: "#4ADE80" },
  { nombre: "Sage", rol: "Centinela", color: "#2DD4BF" },
  { nombre: "Killjoy", rol: "Centinela", color: "#FACC15" },
];

const RANGOS = ["ORO 2", "PLATINO 3", "DIAMANTE 2", "ASCENDENTE 1", "INMORTAL 2", "RADIANTE"];

const COLAS = [
  "Competitivo · Ascent",
  "Competitivo · Bind",
  "Competitivo · Haven",
  "Competitivo · Split",
  "Normal · Sunset",
];

function hashTexto(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function rangoDe(nombre) {
  return RANGOS[hashTexto(nombre) % RANGOS.length];
}

function agenteDe(nombre) {
  return AGENTES[hashTexto(nombre + "_ag") % AGENTES.length];
}

function reproducirSonido(tipo) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (tipo === "UNION") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (tipo === "SALIDA") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(784, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    }
    setTimeout(() => ctx.close(), 320);
  } catch {
    // Ignorar si el navegador bloquea AudioContext
  }
}

function LogoValorant() {
  return (
    <svg className="val-logo-svg" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 6.5L13.5 20.5H8.2L3 13.7V6.5Z" fill="currentColor" />
      <path d="M29 6.5V13.7L19.4 26.5H14.1L29 6.5Z" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState("");
  const [miAgente, setMiAgente] = useState(AGENTES[0]);
  const [cola, setCola] = useState(COLAS[0]);
  const [listo, setListo] = useState(false);
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [errorConexion, setErrorConexion] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const clientRef = useRef(null);
  const finRef = useRef(null);
  const sonidoRef = useRef(sonidoActivo);

  useEffect(() => {
    sonidoRef.current = sonidoActivo;
  }, [sonidoActivo]);

  function conectar(e) {
    e.preventDefault();
    const apodo = usuario.trim();
    if (!apodo) {
      setErrorConexion("Escribe tu Riot ID o apodo para entrar.");
      return;
    }
    setUsuario(apodo);
    setErrorConexion("");
    setConectando(true);
    clientRef.current?.deactivate();

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      onConnect: () => {
        setConectando(false);
        setErrorConexion("");
        setConectado(true);
        client.subscribe("/topic/sala", (frame) => {
          const nuevo = JSON.parse(frame.body);
          setMensajes((prev) => [...prev, nuevo]);
          if (sonidoRef.current) {
            reproducirSonido(nuevo.tipo);
          }
        });
        client.publish({
          destination: "/app/chat.unirse",
          body: JSON.stringify({ tipo: "UNION", autor: apodo }),
        });
      },
      onWebSocketError: () => {
        setConectando(false);
        setErrorConexion("Sin conexión con el servidor (localhost:8080). Verifica que chat-server esté corriendo.");
      },
      onStompError: () => {
        setConectando(false);
        setErrorConexion("Error de protocolo STOMP al conectar con la sala.");
      },
      onWebSocketClose: () => {
        setConectando(false);
        setConectado(false);
      },
    });
    client.activate();
    clientRef.current = client;
  }

  function enviar(tipo, contenido) {
    clientRef.current?.publish({
      destination: "/app/chat.enviar",
      body: JSON.stringify({ tipo, autor: usuario, contenido }),
    });
  }

  function enviarTexto(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    enviar("TEXTO", texto.trim());
    setTexto("");
  }

  function alternarListo() {
    const siguiente = !listo;
    setListo(siguiente);
    enviar(
      "TEXTO",
      siguiente
        ? `Listo para buscar partida (${miAgente.nombre})`
        : "En espera, cambiando agente"
    );
  }

  useEffect(() => () => clientRef.current?.deactivate(), []);
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const miRango = rangoDe(usuario || "Jugador");

  if (!conectado) {
    return (
      <div className="val-shell val-login-wrap">
        <div className="val-bg-accent" aria-hidden="true" />
        <form onSubmit={conectar} className="login val-card">
          <div className="val-eyebrow">
            <LogoValorant />
            <span>PROTOCOLO VALORANT · SALA DE GRUPO</span>
          </div>

          <h1>
            VALORANT<span>SALA COMPETITIVA</span>
          </h1>
          <p className="val-sub">
            Elige tu agente, ingresa tu Riot ID y coordina la estrategia con tu escuadra.
          </p>

          <label className="val-field">
            <span>RIOT ID / APODO</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: TenZ#LAS"
              maxLength={24}
              autoFocus
            />
          </label>

          <div className="val-field">
            <span>SELECCIONA TU AGENTE</span>
            <div className="val-agents-grid">
              {AGENTES.map((ag) => {
                const activo = miAgente.nombre === ag.nombre;
                return (
                  <button
                    key={ag.nombre}
                    type="button"
                    className={`val-agent-chip ${activo ? "is-selected" : ""}`}
                    style={{ "--ag-color": ag.color }}
                    onClick={() => setMiAgente(ag)}
                  >
                    <span className="val-agent-bar" />
                    <div>
                      <strong>{ag.nombre}</strong>
                      <small>{ag.rol}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="val-field">
            <span>COLA Y MAPA</span>
            <select value={cola} onChange={(e) => setCola(e.target.value)}>
              {COLAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {errorConexion && <p className="val-error">{errorConexion}</p>}

          <div className="val-btn-frame">
            <button type="submit" className="val-btn-primary" disabled={conectando}>
              {conectando ? "CONECTANDO..." : "ENTRAR A LA SALA"}
            </button>
          </div>

          <div className="val-login-foot">
            <span>SERVIDOR: BOGOTÁ</span>
            <span>GRUPOS: 5 JUGADORES</span>
            <span>VOZ Y CHAT: EN LÍNEA</span>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="val-shell">
      <div className="val-bg-accent" aria-hidden="true" />
      <main className="chat val-lobby">
        <header className="val-hud">
          <div className="val-hud-left">
            <div className="val-emblem-box">
              <LogoValorant />
            </div>
            <div>
              <div className="val-hud-title">{cola}</div>
              <div className="val-hud-sub">
                <span className="val-dot-live" /> SALA ABIERTA · CHAT DE GRUPO
              </div>
            </div>
          </div>

          <div className="val-hud-right">
            <div className="val-player-card" style={{ "--ag-color": miAgente.color }}>
              <span className="val-player-swatch" />
              <div>
                <strong>{usuario}</strong>
                <small>
                  {miAgente.nombre} · {miAgente.rol} · {miRango}
                </small>
              </div>
            </div>

            <button
              type="button"
              className={`val-ready-btn ${listo ? "is-ready" : ""}`}
              onClick={alternarListo}
            >
              {listo ? "LISTO" : "MARCAR LISTO"}
            </button>

            <button
              type="button"
              className="val-sound-btn"
              onClick={() => setSonidoActivo((s) => !s)}
              title={sonidoActivo ? "Silenciar sonido" : "Activar sonido"}
            >
              {sonidoActivo ? "SONIDO: SÍ" : "SONIDO: NO"}
            </button>
          </div>
        </header>

        <div className="val-status-strip">
          <span>AGENTE: {miAgente.nombre.toUpperCase()} ({miAgente.rol.toUpperCase()})</span>
          <span>RANGO: {miRango}</span>
          <span className={listo ? "val-st-ready" : ""}>
            ESTADO: {listo ? "LISTO PARA BUSCAR PARTIDA" : "EN SALA DE ESPERA"}
          </span>
        </div>

        <ul className="mensajes">
          {mensajes.map((m, i) => {
            const esSistema = m.tipo === "UNION" || m.tipo === "SALIDA";
            const esMio = m.autor === usuario;
            const agenteAutor = esMio ? miAgente : agenteDe(m.autor || "Jugador");
            const rangoAutor = rangoDe(m.autor || "Jugador");

            if (esSistema) {
              return (
                <li
                  key={i}
                  className={`sistema ${m.tipo === "SALIDA" ? "sistema-salida" : "sistema-union"}`}
                >
                  <span className="sys-tag">
                    {m.tipo === "UNION" ? "SE UNIÓ" : "SALIÓ"}
                  </span>
                  <span className="sys-text">{m.contenido}</span>
                  <small>{m.fecha}</small>
                </li>
              );
            }

            return (
              <li
                key={i}
                className={esMio ? "mio" : "otro"}
                style={{ "--ag-color": agenteAutor.color }}
              >
                <div className="msg-head">
                  <span className="msg-agent">{agenteAutor.nombre}</span>
                  <span className="msg-rank">{rangoAutor}</span>
                  <b>{m.autor}</b>
                </div>
                <div className="msg-body">
                  {m.tipo === "TEXTO" && <span>{m.contenido}</span>}
                  {m.tipo === "IMAGEN" && <img src={SERVER + m.contenido} alt="Imagen compartida" />}
                  {m.tipo === "AUDIO" && <audio controls src={SERVER + m.contenido} />}
                </div>
                <small>{m.fecha}</small>
              </li>
            );
          })}
          <li ref={finRef} />
        </ul>

        <form onSubmit={enviarTexto} className="barra">
          <span className="val-channel-tag">GRUPO</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe al chat del grupo..."
          />
          <button type="submit">ENVIAR</button>
        </form>
      </main>
    </div>
  );
}
