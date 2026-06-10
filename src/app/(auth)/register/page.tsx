"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

const SmartWalletIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lg-reg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff" stopOpacity=".22" />
        <stop offset="100%" stopColor="#fff" stopOpacity=".05" />
      </linearGradient>
    </defs>
    <rect width="80" height="80" rx="20" fill="rgba(255,255,255,.12)" />
    <rect width="80" height="40" rx="20" fill="url(#lg-reg)" />
    <rect x="14" y="26" width="52" height="34" rx="7" fill="none" stroke="white" strokeWidth="3.2" strokeOpacity=".95" />
    <line x1="14" y1="38" x2="66" y2="38" stroke="white" strokeWidth="3.2" strokeOpacity=".95" />
    <circle cx="58" cy="22" r="10" fill="#0A2E18" />
    <line x1="58" y1="17" x2="58" y2="27" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    <line x1="53" y1="22" x2="63" y2="22" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
  </svg>
);

export default function RegisterPage() {
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
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Erro ao criar conta");
        return;
      }
      router.push("/login?registered=1");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <>
      <style>{`
        .reg-page { display: grid; grid-template-columns: 1.05fr .95fr; min-height: 100vh; }

        .reg-brand {
          position: relative; overflow: hidden; color: #fff;
          padding: 56px 60px;
          display: flex; flex-direction: column;
          background: linear-gradient(135deg, #0C3D20 0%, #1A7040 100%);
        }
        .reg-brand::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background:
            repeating-linear-gradient(-55deg, transparent, transparent 30px, rgba(255,255,255,.025) 30px, rgba(255,255,255,.025) 31px),
            repeating-linear-gradient( 55deg, transparent, transparent 30px, rgba(255,255,255,.022) 30px, rgba(255,255,255,.022) 31px);
        }
        .reg-glow1 { position: absolute; top: -140px; right: -120px; width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(255,255,255,.11), transparent 62%); pointer-events: none; z-index: 0; }
        .reg-glow2 { position: absolute; bottom: -160px; left: -120px; width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(14,159,110,.18), transparent 64%); pointer-events: none; z-index: 0; }

        .reg-logo { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
        .reg-logo-name { font-family: var(--font-display); font-weight: 700; font-size: 22px; letter-spacing: -.02em; color: #fff; }

        .reg-mid { position: relative; z-index: 1; margin-top: auto; margin-bottom: auto; padding: 40px 0; max-width: 440px; }
        .reg-quote { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1.18; letter-spacing: -.025em; }
        .reg-quote .muted { opacity: .62; }
        .reg-sub { font-size: 16px; opacity: .82; margin-top: 20px; line-height: 1.6; }

        .reg-steps { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; }
        .reg-step { display: flex; align-items: flex-start; gap: 14px; }
        .reg-step-num { width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
          display: grid; place-items: center; font-family: var(--font-display);
          font-weight: 700; font-size: 13px; flex: 0 0 auto; }
        .reg-step-text { padding-top: 4px; }
        .reg-step-text strong { display: block; font-weight: 700; font-size: 14px; }
        .reg-step-text span { font-size: 13px; opacity: .75; }

        .reg-foot { position: relative; z-index: 1; margin-top: 40px; display: flex; align-items: center; gap: 18px; font-size: 13px; opacity: .72; }
        .reg-foot-item { display: inline-flex; align-items: center; gap: 7px; }

        /* Form panel */
        .reg-form-panel {
          display: flex; align-items: center; justify-content: center;
          padding: 48px 40px; background: var(--surface);
        }
        .reg-card { width: 100%; max-width: 400px; }

        .reg-mobile-logo { display: none; align-items: center; gap: 11px; justify-content: center; margin-bottom: 36px; }
        .reg-mobile-logo-name { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--ink); }

        .reg-head { margin-bottom: 28px; }
        .reg-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase; color: var(--pos); margin-bottom: 14px; }
        .reg-eyebrow::before { content: ''; width: 20px; height: 2px; background: linear-gradient(135deg, #0C3D20, var(--pos)); border-radius: 2px; }
        .reg-head h1 { font-family: var(--font-display); font-weight: 700; font-size: 28px; letter-spacing: -.025em; line-height: 1.1; color: var(--ink); }
        .reg-head p { font-size: 15px; color: var(--ink-2); margin-top: 10px; }

        .reg-social { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--surface); border: 1.5px solid var(--line); border-radius: 12px;
          padding: 13px; font-family: var(--font-body); font-weight: 600; font-size: 14.5px;
          color: var(--ink); cursor: pointer; transition: background .15s, border-color .15s; }
        .reg-social:hover { background: var(--surface-2); border-color: rgba(21,84,61,.22); }
        .reg-social:disabled { opacity: .6; cursor: not-allowed; }

        .reg-divider { display: flex; align-items: center; gap: 14px; margin: 20px 0; }
        .reg-divider::before, .reg-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
        .reg-divider span { font-size: 12.5px; font-weight: 600; color: var(--ink-3); }

        .reg-field { margin-bottom: 16px; }
        .reg-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-2); margin-bottom: 7px; }
        .reg-input-wrap { position: relative; }
        .reg-ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          width: 18px; height: 18px; color: var(--ink-3); pointer-events: none; }
        .reg-input {
          width: 100%; font-family: var(--font-body); font-size: 14.5px; font-weight: 500;
          color: var(--ink); background: var(--surface); border: 1.5px solid var(--line);
          border-radius: 12px; padding: 12px 44px 12px 42px;
          transition: border-color .15s, box-shadow .15s;
        }
        .reg-input::placeholder { color: var(--ink-3); font-weight: 400; }
        .reg-input:focus { outline: none; border-color: var(--pos); box-shadow: 0 0 0 3px rgba(14,159,110,.12); }
        .reg-input.has-error { border-color: var(--neg); }
        .reg-input.no-icon { padding-left: 14px; }
        .reg-error { font-size: 12.5px; color: var(--neg); font-weight: 600; margin-top: 5px; }
        .reg-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; border: none; background: none; cursor: pointer;
          color: var(--ink-3); display: grid; place-items: center; border-radius: 8px; }
        .reg-eye:hover { background: var(--surface-2); color: var(--ink-2); }

        .reg-global-error { background: var(--neg-soft); color: var(--neg); border-radius: 10px;
          padding: 10px 14px; font-size: 13.5px; font-weight: 600; margin-bottom: 18px; }

        .reg-submit {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          background: linear-gradient(135deg, #0C3D20 0%, #1A7040 100%);
          color: #fff; border: none; cursor: pointer; font-family: var(--font-body);
          font-weight: 700; font-size: 15.5px; padding: 15px; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(12,61,32,.30);
          transition: transform .18s, box-shadow .18s; margin-top: 4px;
        }
        .reg-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 38px rgba(12,61,32,.38); }
        .reg-submit:disabled { opacity: .65; cursor: not-allowed; transform: none; box-shadow: 0 8px 28px rgba(12,61,32,.20); }

        .reg-login { text-align: center; font-size: 14px; color: var(--ink-2); margin-top: 22px; }
        .reg-login a { font-weight: 700; color: var(--pos); text-decoration: none; }
        .reg-login a:hover { text-decoration: underline; }

        @media (max-width: 900px) {
          .reg-page { grid-template-columns: 1fr; }
          .reg-brand { display: none; }
          .reg-form-panel { padding: 40px 28px; background: var(--canvas); }
          .reg-mobile-logo { display: flex; }
        }
        @media (max-width: 420px) {
          .reg-form-panel { padding: 32px 20px; }
          .reg-head h1 { font-size: 24px; }
        }
      `}</style>

      <div className="reg-page">

        {/* ── LEFT BRAND ── */}
        <div className="reg-brand">
          <div className="reg-glow1" />
          <div className="reg-glow2" />

          <div className="reg-logo">
            <SmartWalletIcon size={40} />
            <div className="reg-logo-name">SmartWallet<sup style={{ fontSize: "14px", opacity: .8 }}>+</sup></div>
          </div>

          <div className="reg-mid">
            <div className="reg-quote">
              Comece agora <span className="muted">— é grátis e leva 1 minuto.</span>
            </div>
            <p className="reg-sub">
              Crie sua conta e tenha seu fluxo de caixa, parcelas e assinaturas organizados automaticamente a partir de hoje.
            </p>
          </div>

          <div className="reg-steps">
            <div className="reg-step">
              <div className="reg-step-num">1</div>
              <div className="reg-step-text">
                <strong>Crie sua conta</strong>
                <span>E-mail ou Google, em segundos</span>
              </div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num">2</div>
              <div className="reg-step-text">
                <strong>Configure seus bancos</strong>
                <span>Caixa, Nubank, Inter e mais 4 bancos</span>
              </div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num">3</div>
              <div className="reg-step-text">
                <strong>Lance receitas e despesas</strong>
                <span>O app organiza tudo mês a mês sozinho</span>
              </div>
            </div>
          </div>

          <div className="reg-foot">
            <span className="reg-foot-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Dados protegidos
            </span>
            <span className="reg-foot-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Sem propagandas
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM ── */}
        <div className="reg-form-panel">
          <div className="reg-card">

            <div className="reg-mobile-logo">
              <svg width="34" height="34" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="lg-mob-reg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0C3D20" />
                    <stop offset="100%" stopColor="#1A7040" />
                  </linearGradient>
                </defs>
                <rect width="80" height="80" rx="20" fill="url(#lg-mob-reg)" />
                <rect x="14" y="26" width="52" height="34" rx="7" fill="none" stroke="white" strokeWidth="3.2" strokeOpacity=".9" />
                <line x1="14" y1="38" x2="66" y2="38" stroke="white" strokeWidth="3.2" strokeOpacity=".9" />
                <circle cx="58" cy="22" r="10" fill="#0A2E18" />
                <line x1="58" y1="17" x2="58" y2="27" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="53" y1="22" x2="63" y2="22" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
              <div className="reg-mobile-logo-name">SmartWallet<sup style={{ fontSize: "12px" }}>+</sup></div>
            </div>

            <div className="reg-head">
              <div className="reg-eyebrow">Criar conta grátis</div>
              <h1>Comece a controlar seu dinheiro</h1>
              <p>Sem cartão de crédito. Cancele quando quiser.</p>
            </div>

            {/* Google */}
            <button type="button" className="reg-social" onClick={handleGoogle} disabled={googleLoading || loading}>
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? "Redirecionando..." : "Criar conta com Google"}
            </button>

            <div className="reg-divider"><span>ou com e-mail</span></div>

            {error && <div className="reg-global-error">{error}</div>}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Nome */}
              <div className="reg-field">
                <label htmlFor="name" className="reg-label">Nome completo</label>
                <div className="reg-input-wrap">
                  <svg className="reg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="name"
                    type="text"
                    className={`reg-input${errors.name ? " has-error" : ""}`}
                    placeholder="João Silva"
                    autoComplete="name"
                    {...register("name")}
                  />
                </div>
                {errors.name && <div className="reg-error">{errors.name.message}</div>}
              </div>

              {/* Email */}
              <div className="reg-field">
                <label htmlFor="reg-email" className="reg-label">E-mail</label>
                <div className="reg-input-wrap">
                  <svg className="reg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="reg-email"
                    type="email"
                    className={`reg-input${errors.email ? " has-error" : ""}`}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    {...register("email")}
                  />
                </div>
                {errors.email && <div className="reg-error">{errors.email.message}</div>}
              </div>

              {/* Senha */}
              <div className="reg-field">
                <label htmlFor="reg-senha" className="reg-label">Senha</label>
                <div className="reg-input-wrap">
                  <svg className="reg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="reg-senha"
                    type={showPassword ? "text" : "password"}
                    className={`reg-input${errors.password ? " has-error" : ""}`}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="reg-eye"
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
                {errors.password && <div className="reg-error">{errors.password.message}</div>}
              </div>

              <button type="submit" className="reg-submit" disabled={loading || googleLoading}>
                {loading ? "Criando conta..." : "Criar conta grátis"}
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>

            <div className="reg-login">
              Já tem conta? <Link href="/login">Entrar</Link>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
