"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Confetti from "react-confetti";
import anime from "animejs";
import * as Matter from "matter-js";
import { useWindowSize } from "react-use";

import styles from "./page.module.css";

const APP_NAME = "AIVoice";
const DEFAULT_TEXT_PROMPT = "You enjoy having a good conversation.";
const DEFAULT_VOICE = "NATF0.pt";
const DEFAULT_SERVER =
    process.env.NEXT_PUBLIC_PERSONAPLEX_URL ?? "https://your-railway-app.up.railway.app";

const isBrowser = typeof window !== "undefined";

const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

const joinPath = (basePath: string, subPath: string) => {
    const safeBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    const safeSub = subPath.startsWith("/") ? subPath : `/${subPath}`;
    return `${safeBase}${safeSub}` || "/";
};

const buildChatUrl = (serverUrl: string) => {
    const normalized = normalizeUrl(serverUrl);
    if (!normalized) {
        return "";
    }
    const url = new URL(normalized);
    url.pathname = joinPath(url.pathname, "/api/chat");
    url.searchParams.set("text_prompt", DEFAULT_TEXT_PROMPT);
    url.searchParams.set("voice_prompt", DEFAULT_VOICE);
    url.searchParams.set("text_temperature", "0.8");
    url.searchParams.set("text_topk", "40");
    url.searchParams.set("audio_temperature", "0.8");
    url.searchParams.set("audio_topk", "40");
    url.searchParams.set("pad_mult", "1");
    url.searchParams.set("text_seed", "42");
    url.searchParams.set("audio_seed", "42");
    url.searchParams.set("repetition_penalty_context", "16");
    url.searchParams.set("repetition_penalty", "1.1");
    return url;
};

const buildWebSocketUrl = (serverUrl: string) => {
    const chatUrl = buildChatUrl(serverUrl);
    if (!chatUrl) {
        return "";
    }
    const wsUrl = new URL(chatUrl.toString());
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    return wsUrl.toString();
};

const loadSavedServer = () => {
    if (!isBrowser) {
        return DEFAULT_SERVER;
    }
    return window.localStorage.getItem("aivoice_server_url") ?? DEFAULT_SERVER;
};

const saveServer = (value: string) => {
    if (!isBrowser) {
        return;
    }
    window.localStorage.setItem("aivoice_server_url", value);
};

export default function Home() {
    const { width, height } = useWindowSize();
    const [serverUrl, setServerUrl] = useState(loadSavedServer());
    const [status, setStatus] = useState<"idle" | "checking" | "connected" | "failed">("idle");
    const [statusNote, setStatusNote] = useState("Not checked yet.");
    const [embedEnabled, setEmbedEnabled] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const heroCardRef = useRef<HTMLDivElement | null>(null);
    const orbRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        saveServer(serverUrl);
    }, [serverUrl]);

    useEffect(() => {
        const card = heroCardRef.current;
        const orb = orbRef.current;
        if (!card || !orb) return;

        const cardAnimation = anime({
            targets: card,
            translateY: [0, -6],
            direction: "alternate",
            easing: "easeInOutSine",
            duration: 2200,
            loop: true,
        });

        const orbAnimation = anime({
            targets: orb,
            translateX: [0, 16],
            translateY: [0, -12],
            scale: [1, 1.08],
            direction: "alternate",
            easing: "easeInOutQuad",
            duration: 2600,
            loop: true,
        });

        return () => {
            cardAnimation.pause();
            orbAnimation.pause();
        };
    }, []);

    useEffect(() => {
        const container = sceneRef.current;
        if (!container) return;

        const engine = Matter.Engine.create();
        const render = Matter.Render.create({
            element: container,
            engine,
            options: {
                width: container.clientWidth,
                height: 160,
                background: "transparent",
                wireframes: false,
            },
        });

        const ground = Matter.Bodies.rectangle(
            render.options.width / 2,
            150,
            render.options.width,
            20,
            { isStatic: true, render: { fillStyle: "#e2e8f0" } }
        );
        const leftWall = Matter.Bodies.rectangle(0, 80, 10, 160, {
            isStatic: true,
            render: { fillStyle: "transparent" },
        });
        const rightWall = Matter.Bodies.rectangle(render.options.width, 80, 10, 160, {
            isStatic: true,
            render: { fillStyle: "transparent" },
        });

        const balls = Array.from({ length: 6 }).map((_, index) =>
            Matter.Bodies.circle(40 + index * 40, 20 + index * 6, 12, {
                restitution: 0.85,
                render: {
                    fillStyle: ["#6366f1", "#22c55e", "#f97316", "#0ea5e9", "#a855f7", "#f43f5e"][index % 6],
                },
            })
        );

        Matter.World.add(engine.world, [ground, leftWall, rightWall, ...balls]);
        Matter.Engine.run(engine);
        Matter.Render.run(render);

        const handleResize = () => {
            const width = container.clientWidth;
            render.canvas.width = width;
            render.options.width = width;
            Matter.Body.setPosition(ground, { x: width / 2, y: 150 });
            Matter.Body.setPosition(rightWall, { x: width, y: 80 });
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            Matter.Render.stop(render);
            Matter.Engine.clear(engine);
            if (render.canvas.parentNode) {
                render.canvas.parentNode.removeChild(render.canvas);
            }
        };
    }, []);

    const normalizedServerUrl = useMemo(() => normalizeUrl(serverUrl), [serverUrl]);
    const wsUrl = useMemo(() => buildWebSocketUrl(serverUrl), [serverUrl]);

    const handleTestConnection = () => {
        if (!wsUrl) {
            setStatus("failed");
            setStatusNote("Add a valid server URL first.");
            return;
        }
        setStatus("checking");
        setStatusNote("Connecting to your PersonaPlex server...");

        let resolved = false;
        const socket = new WebSocket(wsUrl);
        socket.binaryType = "arraybuffer";

        const timeoutId = window.setTimeout(() => {
            if (resolved) return;
            resolved = true;
            socket.close();
            setStatus("failed");
            setStatusNote("Timed out. Check the server URL or deployment logs.");
        }, 5000);

        socket.addEventListener("message", (event) => {
            if (resolved) return;
            const data = event.data;
            if (data instanceof ArrayBuffer) {
                const bytes = new Uint8Array(data);
                if (bytes.length > 0 && bytes[0] === 0) {
                    resolved = true;
                    window.clearTimeout(timeoutId);
                    socket.close();
                    setStatus("connected");
                    setStatusNote("Handshake received. Server is ready.");
                    setShowConfetti(true);
                    window.setTimeout(() => setShowConfetti(false), 1800);
                }
            }
        });

        socket.addEventListener("error", () => {
            if (resolved) return;
            resolved = true;
            window.clearTimeout(timeoutId);
            setStatus("failed");
            setStatusNote("Connection failed. Verify SSL and firewall settings.");
        });

        socket.addEventListener("close", () => {
            if (resolved) return;
            resolved = true;
            window.clearTimeout(timeoutId);
            setStatus("failed");
            setStatusNote("Socket closed before handshake.");
        });
    };

    return (
        <main className={styles.page}>
            <Confetti
                width={width}
                height={height}
                recycle={showConfetti}
                numberOfPieces={showConfetti ? 140 : 0}
            />
            <section className={`section ${styles.hero}`}>
                <div className="container">
                    <div className={styles.heroGrid}>
                        <div>
                            <p className={styles.eyebrow}>Always-on voice assistant</p>
                            <h1 className="title is-2">{APP_NAME} Voice Hub</h1>
                            <p className="subtitle is-5">
                                A polished front-end that connects to your PersonaPlex server so you can
                                talk to your AI anywhere, anytime.
                            </p>
                            <div className={styles.heroActions}>
                                <a
                                    className="button is-primary is-medium"
                                    href={normalizedServerUrl || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open Voice Chat
                                </a>
                                <button
                                    className="button is-light is-medium"
                                    type="button"
                                    onClick={handleTestConnection}
                                >
                                    Test Connection
                                </button>
                            </div>
                            <div className={styles.statusRow}>
                                <span className={`${styles.statusDot} ${styles[status]}`} />
                                <span>{statusNote}</span>
                            </div>
                            <div className={styles.badges}>
                                <span>Realtime voice</span>
                                <span>Full duplex</span>
                                <span>Persona control</span>
                            </div>
                        </div>
                        <div className={styles.heroVisual}>
                            <div className={styles.heroOrb} ref={orbRef} />
                            <div className={styles.scene} ref={sceneRef} aria-hidden="true" />
                        </div>
                        <div className={styles.heroCard} ref={heroCardRef}>
                            <h2 className="title is-5">Server Settings</h2>
                            <p className="subtitle is-6">
                                Point this UI to your hosted PersonaPlex server (Railway recommended for GPU).
                            </p>
                            <label className="label" htmlFor="server-url">Server URL</label>
                            <div className={styles.inputRow}>
                                <input
                                    id="server-url"
                                    className="input"
                                    placeholder="https://your-railway-app.up.railway.app"
                                    value={serverUrl}
                                    onChange={(event) => setServerUrl(event.target.value)}
                                />
                            </div>
                            <div className={styles.helperText}>
                                Must be HTTPS for microphone access in browsers.
                            </div>
                            <div className={styles.inlineToggle}>
                                <input
                                    id="embed-toggle"
                                    type="checkbox"
                                    checked={embedEnabled}
                                    onChange={(event) => setEmbedEnabled(event.target.checked)}
                                />
                                <label htmlFor="embed-toggle">Embed voice UI below</label>
                            </div>
                            <button
                                className="button is-link is-fullwidth"
                                type="button"
                                onClick={() => setShowConfetti(true)}
                            >
                                Celebrate launch
                            </button>
                            <div className={styles.infoPanel}>
                                <h3 className="title is-6">Defaults</h3>
                                <div className={styles.defaultsGrid}>
                                    <div>
                                        <span>Text prompt</span>
                                        <strong>{DEFAULT_TEXT_PROMPT}</strong>
                                    </div>
                                    <div>
                                        <span>Voice</span>
                                        <strong>{DEFAULT_VOICE}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="container">
                    <div className={styles.featureGrid}>
                        <div className={styles.featureCard}>
                            <h3 className="title is-5">Anywhere access</h3>
                            <p>
                                Deploy the voice server on Railway (GPU) and keep this front-end on Vercel.
                                Your AI stays reachable from any device.
                            </p>
                        </div>
                        <div className={styles.featureCard}>
                            <h3 className="title is-5">Clean experience</h3>
                            <p>
                                Simple connection controls, status checks, and a built-in embed for the official
                                PersonaPlex UI.
                            </p>
                        </div>
                        <div className={styles.featureCard}>
                            <h3 className="title is-5">Voice fidelity</h3>
                            <p>
                                Supports the NAT/VAR voice presets, full duplex audio, and live text display from
                                the server.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="container">
                    <div className={styles.embedHeader}>
                        <h2 className="title is-4">Voice Console</h2>
                        <p className="subtitle is-6">
                            The embedded console streams audio directly from your PersonaPlex server.
                        </p>
                    </div>
                    {embedEnabled && normalizedServerUrl ? (
                        <div className={styles.embedShell}>
                            <iframe
                                title="PersonaPlex Voice"
                                src={normalizedServerUrl}
                                className={styles.embedFrame}
                                allow="microphone"
                            />
                        </div>
                    ) : (
                        <div className={styles.embedPlaceholder}>
                            Enable embedding and add a server URL to load the console here.
                        </div>
                    )}
                </div>
            </section>

            <section className="section">
                <div className="container">
                    <div className={styles.faqGrid}>
                        <div>
                            <h2 className="title is-4">FAQs</h2>
                            <div className={styles.faqItem}>
                                <h3 className="title is-6">Is PersonaPlex free?</h3>
                                <p>
                                    The code is MIT-licensed and the model weights use the NVIDIA Open Model
                                    license. You can use it, but hosting GPU hardware is not free.
                                </p>
                            </div>
                            <div className={styles.faqItem}>
                                <h3 className="title is-6">Can it look things up on the web?</h3>
                                <p>
                                    Not by default. You would need to connect a separate search or browsing API
                                    on the backend and surface the results in prompts.
                                </p>
                            </div>
                            <div className={styles.faqItem}>
                                <h3 className="title is-6">Where should I deploy?</h3>
                                <p>
                                    Use Vercel for this front-end. Use Railway for the GPU-backed PersonaPlex
                                    server if Vercel cannot host the backend.
                                </p>
                            </div>
                        </div>
                        <div className={styles.nextSteps}>
                            <h3 className="title is-5">Next steps</h3>
                            <ol>
                                <li>Deploy PersonaPlex on Railway with GPU and HTTPS.</li>
                                <li>Set NEXT_PUBLIC_PERSONAPLEX_URL on Vercel.</li>
                                <li>Open the AIVoice site and start talking.</li>
                            </ol>
                            <a
                                className="button is-link is-fullwidth"
                                href={normalizedServerUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Launch Voice Chat
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
