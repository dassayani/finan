"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setError("Email ou senha inválidos");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <>
      <style>{`
        .login-page { display: grid; grid-template-columns: 1.05fr .95fr; min-height: 100vh; }

        /* ── Brand panel ── */
        .brand-panel {
          position: relative; overflow: hidden; color: #fff;
          padding: 56px 60px;
          display: flex; flex-direction: column;
          background: linear-gradient(135deg, #0C3D20 0%, #1A7040 100%);
        }
        .brand-panel::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background:
            repeating-linear-gradient(-55deg, transparent, transparent 30px, rgba(255,255,255,.025) 30px, rgba(255,255,255,.025) 31px),
            repeating-linear-gradient( 55deg, transparent, transparent 30px, rgba(255,255,255,.022) 30px, rgba(255,255,255,.022) 31px);
        }
        .bp-glow1 { position: absolute; top: -140px; right: -120px; width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(255,255,255,.11), transparent 62%); pointer-events: none; z-index: 0; }
        .bp-glow2 { position: absolute; bottom: -160px; left: -120px; width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(14,159,110,.18), transparent 64%); pointer-events: none; z-index: 0; }

        .bp-logo { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
        .bp-logo-name { font-family: var(--font-display); font-weight: 700; font-size: 22px; letter-spacing: -.02em; color: #fff; }

        .bp-mid { position: relative; z-index: 1; margin-top: auto; margin-bottom: auto; padding: 40px 0; max-width: 440px; }
        .bp-quote { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1.18; letter-spacing: -.025em; }
        .bp-quote .muted { opacity: .62; }
        .bp-sub { font-size: 16px; opacity: .82; margin-top: 20px; line-height: 1.6; }

        .bp-stats { position: relative; z-index: 1; display: flex; gap: 14px; flex-wrap: wrap; }
        .bp-stat { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16);
          border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(8px); flex: 1; min-width: 130px; }
        .bp-stat .sv { font-family: var(--font-display); font-weight: 700; font-size: 21px; letter-spacing: -.02em; }
        .bp-stat .sl { font-size: 12.5px; opacity: .78; margin-top: 3px; }

        .bp-foot { position: relative; z-index: 1; margin-top: 40px; display: flex; align-items: center; gap: 18px; font-size: 13px; opacity: .72; }
        .bp-foot-item { display: inline-flex; align-items: center; gap: 7px; }

        /* ── Form panel ── */
        .form-panel {
          display: flex; align-items: center; justify-content: center;
          padding: 48px 40px; background: var(--surface);
        }
        .form-card { width: 100%; max-width: 400px; }

        .mobile-logo { display: none; align-items: center; gap: 11px; justify-content: center; margin-bottom: 36px; }
        .mobile-logo-name { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--ink); }

        .fc-head { margin-bottom: 32px; }
        .fc-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase; color: var(--pos); margin-bottom: 14px; }
        .fc-eyebrow::before { content: ''; width: 20px; height: 2px; background: linear-gradient(135deg, #0C3D20, var(--pos)); border-radius: 2px; }
        .fc-head h1 { font-family: var(--font-display); font-weight: 700; font-size: 30px; letter-spacing: -.025em; line-height: 1.1; color: var(--ink); }
        .fc-head p { font-size: 15px; color: var(--ink-2); margin-top: 10px; }

        .social-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--surface); border: 1.5px solid var(--line); border-radius: 12px;
          padding: 13px; font-family: var(--font-body); font-weight: 600; font-size: 14.5px;
          color: var(--ink); cursor: pointer; transition: background .15s, border-color .15s;
        }
        .social-btn:hover { background: var(--surface-2); border-color: rgba(21,84,61,.22); }
        .social-btn:disabled { opacity: .6; cursor: not-allowed; }

        .lv-divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; }
        .lv-divider::before, .lv-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
        .lv-divider span { font-size: 12.5px; font-weight: 600; color: var(--ink-3); }

        .lv-field { margin-bottom: 18px; }
        .lv-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-2); margin-bottom: 8px; }
        .lv-input-wrap { position: relative; }
        .lv-ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          width: 18px; height: 18px; color: var(--ink-3); pointer-events: none; }
        .lv-input {
          width: 100%; font-family: var(--font-body); font-size: 14.5px; font-weight: 500;
          color: var(--ink); background: var(--surface); border: 1.5px solid var(--line);
          border-radius: 12px; padding: 13px 44px 13px 42px;
          transition: border-color .15s, box-shadow .15s;
        }
        .lv-input::placeholder { color: var(--ink-3); font-weight: 400; }
        .lv-input:focus { outline: none; border-color: var(--pos); box-shadow: 0 0 0 3px rgba(14,159,110,.12); }
        .lv-input.has-error { border-color: var(--neg); }
        .lv-error { font-size: 12.5px; color: var(--neg); font-weight: 600; margin-top: 5px; }
        .lv-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; border: none; background: none; cursor: pointer;
          color: var(--ink-3); display: grid; place-items: center; border-radius: 8px; }
        .lv-eye:hover { background: var(--surface-2); color: var(--ink-2); }

        .lv-row-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .lv-remember { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: 13.5px; font-weight: 500; color: var(--ink-2); }
        .lv-remember input { display: none; }
        .lv-chk-box { width: 19px; height: 19px; border-radius: 6px; border: 1.5px solid var(--line);
          background: var(--surface); display: grid; place-items: center; transition: all .15s; flex: 0 0 auto; }
        .lv-chk-box svg { width: 12px; height: 12px; color: #fff; opacity: 0; transition: opacity .15s; }
        .lv-remember input:checked + .lv-chk-box { background: linear-gradient(135deg, #0C3D20, #1A7040); border-color: transparent; }
        .lv-remember input:checked + .lv-chk-box svg { opacity: 1; }
        .lv-forgot { font-size: 13.5px; font-weight: 600; color: var(--pos); text-decoration: none; }
        .lv-forgot:hover { text-decoration: underline; }

        .lv-submit {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          background: linear-gradient(135deg, #0C3D20 0%, #1A7040 100%);
          color: #fff; border: none; cursor: pointer; font-family: var(--font-body);
          font-weight: 700; font-size: 15.5px; padding: 15px; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(12,61,32,.30);
          transition: transform .18s, box-shadow .18s;
        }
        .lv-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 38px rgba(12,61,32,.38); }
        .lv-submit:disabled { opacity: .65; cursor: not-allowed; transform: none; box-shadow: 0 8px 28px rgba(12,61,32,.20); }

        .lv-global-error { background: var(--neg-soft); color: var(--neg); border-radius: 10px;
          padding: 10px 14px; font-size: 13.5px; font-weight: 600; margin-bottom: 20px; }

        .lv-signup { text-align: center; font-size: 14px; color: var(--ink-2); margin-top: 26px; }
        .lv-signup a { font-weight: 700; color: var(--pos); text-decoration: none; }
        .lv-signup a:hover { text-decoration: underline; }

        @media (max-width: 900px) {
          .login-page { grid-template-columns: 1fr; }
          .brand-panel { display: none; }
          .form-panel { padding: 40px 28px; background: var(--canvas); }
          .mobile-logo { display: flex; }
        }
        @media (max-width: 420px) {
          .form-panel { padding: 32px 20px; }
          .fc-head h1 { font-size: 26px; }
        }
      `}</style>

      <div className="login-page">

        {/* ── LEFT BRAND PANEL ── */}
        <div className="brand-panel">
          <div className="bp-glow1" />
          <div className="bp-glow2" />

          <div className="bp-logo">
            <svg width="40" height="40" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lg-brand" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff" stopOpacity=".22" />
                  <stop offset="100%" stopColor="#fff" stopOpacity=".05" />
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="20" fill="rgba(255,255,255,.12)" />
              <rect width="80" height="40" rx="20" fill="url(#lg-brand)" />
              <rect x="14" y="26" width="52" height="34" rx="7" fill="none" stroke="white" strokeWidth="3.2" strokeOpacity=".95" />
              <line x1="14" y1="38" x2="66" y2="38" stroke="white" strokeWidth="3.2" strokeOpacity=".95" />
              <circle cx="58" cy="22" r="10" fill="#0A2E18" />
              <line x1="58" y1="17" x2="58" y2="27" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="53" y1="22" x2="63" y2="22" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
            <div className="bp-logo-name">SmartWallet<sup style={{ fontSize: "14px", opacity: .8 }}>+</sup></div>
          </div>

          <div className="bp-mid">
            <div className="bp-quote">
              Seu dinheiro organizado <span className="muted">— mês a mês, sozinho.</span>
            </div>
            <p className="bp-sub">
              Entre e veja seu fluxo de caixa, parcelas e assinaturas já montados para o mês.
              É só conferir e marcar o que pagou.
            </p>
          </div>

          <div className="bp-stats">
            <div className="bp-stat">
              <div className="sv">Automático</div>
              <div className="sl">Lançamentos por mês</div>
            </div>
            <div className="bp-stat">
              <div className="sv">7 bancos</div>
              <div className="sl">Integração nativa</div>
            </div>
            <div className="bp-stat">
              <div className="sv">100% PT</div>
              <div className="sl">Feito pro Brasil</div>
            </div>
          </div>

          <div className="bp-foot">
            <span className="bp-foot-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Dados protegidos
            </span>
            <span className="bp-foot-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Sem propagandas
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="form-panel">
          <div className="form-card">

            {/* Mobile logo (shown when brand panel is hidden) */}
            <div className="mobile-logo">
              <svg width="34" height="34" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="lg-mob" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0C3D20" />
                    <stop offset="100%" stopColor="#1A7040" />
                  </linearGradient>
                </defs>
                <rect width="80" height="80" rx="20" fill="url(#lg-mob)" />
                <rect x="14" y="26" width="52" height="34" rx="7" fill="none" stroke="white" strokeWidth="3.2" strokeOpacity=".9" />
                <line x1="14" y1="38" x2="66" y2="38" stroke="white" strokeWidth="3.2" strokeOpacity=".9" />
                <circle cx="58" cy="22" r="10" fill="#0A2E18" />
                <line x1="58" y1="17" x2="58" y2="27" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="53" y1="22" x2="63" y2="22" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
              <div className="mobile-logo-name">SmartWallet<sup style={{ fontSize: "12px", background: "linear-gradient(135deg,#0C3D20,var(--pos))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>+</sup></div>
            </div>

            <div className="fc-head">
              <div className="fc-eyebrow">Bem-vindo de volta</div>
              <h1>Entrar na sua conta</h1>
              <p>Continue de onde parou no controle do seu mês.</p>
            </div>

            {/* Google sign-in */}
            <button
              type="button"
              className="social-btn"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            >
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? "Redirecionando..." : "Entrar com Google"}
            </button>

            <div className="lv-divider"><span>ou com e-mail</span></div>

            {error && <div className="lv-global-error">{error}</div>}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div className="lv-field">
                <label htmlFor="email" className="lv-label">E-mail</label>
                <div className="lv-input-wrap">
                  <svg className="lv-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    className={`lv-input${errors.email ? " has-error" : ""}`}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    {...register("email")}
                  />
                </div>
                {errors.email && <div className="lv-error">{errors.email.message}</div>}
              </div>

              {/* Password */}
              <div className="lv-field">
                <label htmlFor="senha" className="lv-label">Senha</label>
                <div className="lv-input-wrap">
                  <svg className="lv-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    className={`lv-input${errors.password ? " has-error" : ""}`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="lv-eye"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <div className="lv-error">{errors.password.message}</div>}
              </div>

              {/* Remember + Forgot */}
              <div className="lv-row-between">
                <label className="lv-remember">
                  <input type="checkbox" />
                  <span className="lv-chk-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  Manter conectado
                </label>
                <Link href="/forgot-password" className="lv-forgot">Esqueci a senha</Link>
              </div>

              <button type="submit" className="lv-submit" disabled={loading || googleLoading}>
                {loading ? "Entrando..." : "Entrar"}
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>

            <div className="lv-signup">
              Ainda não tem conta? <Link href="/register">Criar grátis</Link>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
