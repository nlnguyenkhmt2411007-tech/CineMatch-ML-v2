import { useEffect, useRef, useState } from "react";
import { ArrowRight, Volume2, VolumeX, X } from "lucide-react";
import { CineMatchLogo } from "../branding/CineMatchLogo";

interface CinematicIntroProps {
  onComplete: () => void;
}

const DURATION = 9000;
const VOICE_DELAY = 1500;

export function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [started, setStarted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [finished, setFinished] = useState(false);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const completedRef = useRef(false);

  const stopAudio = () => {
    for (const audio of [musicRef.current, voiceRef.current]) {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
    musicRef.current = null;
    voiceRef.current = null;
  };

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;

    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    stopAudio();

    setFinished(true);
    onComplete();
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout);
      for (const audio of [musicRef.current, voiceRef.current]) {
        if (audio) audio.pause();
      }
    };
  }, []);

  const start = (withSound: boolean) => {
    if (started || completedRef.current) return;

    setStarted(true);
    setSoundEnabled(withSound);

    if (withSound) {
      const music = new Audio("/audio/cinematic/cinematch_score_v3.wav");
      const voice = new Audio("/audio/cinematic/cinematch_voice_v1.mp3");

      musicRef.current = music;
      voiceRef.current = voice;

      music.volume = 0.5;
      voice.volume = 0.95;

      void music.play().catch(console.warn);

      timersRef.current.push(
        window.setTimeout(() => {
          if (completedRef.current) return;
          music.volume = 0.23;
          void voice.play().catch(console.warn);
        }, VOICE_DELAY)
      );

      timersRef.current.push(
        window.setTimeout(() => {
          if (!completedRef.current && musicRef.current) {
            musicRef.current.volume = 0.65;
          }
        }, 7100)
      );
    }

    timersRef.current.push(window.setTimeout(finish, DURATION));
  };

  if (finished) return null;

  return (
    <div
      className={`cm2 ${started ? "cm2--playing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="CineMatch cinematic introduction"
    >
      <style>{`
        .cm2 {
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          background: #020307;
          color: #fff4dc;
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .cm2 * { box-sizing: border-box; }

        .cm2__backdrop {
          position: absolute;
          inset: -15%;
          background:
            radial-gradient(ellipse at 50% 52%, #32200f 0%, transparent 38%),
            radial-gradient(ellipse at 70% 20%, #182232 0%, transparent 40%),
            #020307;
          opacity: .65;
        }

        .cm2--playing .cm2__backdrop {
          animation: cm2Camera 9s ease-in-out forwards;
        }

        .cm2__beam {
          position: absolute;
          width: 130vw;
          height: 65vh;
          left: -40vw;
          top: 8vh;
          transform: rotate(-17deg) translateX(-120%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,195,105,.02),
            rgba(255,214,139,.3),
            rgba(255,195,105,.03),
            transparent
          );
          filter: blur(25px);
          opacity: 0;
          pointer-events: none;
        }

        .cm2--playing .cm2__beam {
          animation: cm2Beam 6.8s ease-in-out forwards;
        }

        .cm2__film {
          position: absolute;
          width: 150vw;
          height: 105px;
          left: -25vw;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 0;
          border-top: 8px dashed rgba(225,177,94,.5);
          border-bottom: 8px dashed rgba(225,177,94,.5);
          background: rgba(18,14,12,.85);
          box-shadow: 0 0 45px rgba(230,164,70,.14);
          opacity: 0;
          pointer-events: none;
        }

        .cm2__film--one {
          top: 19%;
          transform: rotate(-18deg) translateX(-70%);
        }

        .cm2__film--two {
          bottom: 18%;
          transform: rotate(17deg) translateX(70%);
        }

        .cm2--playing .cm2__film--one {
          animation: cm2FilmOne 6.5s ease-in-out forwards;
        }

        .cm2--playing .cm2__film--two {
          animation: cm2FilmTwo 6.5s ease-in-out forwards;
        }

        .cm2__frame {
          flex: 0 0 145px;
          height: 68px;
          border: 1px solid rgba(234,184,109,.5);
          background:
            linear-gradient(135deg, rgba(229,172,79,.12), transparent),
            radial-gradient(circle at 55% 50%, #3d2c1c, #080a0e);
        }

        .cm2__halo {
          position: absolute;
          width: min(75vw, 650px);
          aspect-ratio: 1;
          border-radius: 50%;
          border: 1px solid rgba(235,189,112,.3);
          box-shadow:
            0 0 100px rgba(229,163,67,.13),
            inset 0 0 90px rgba(229,163,67,.1);
          opacity: 0;
          transform: scale(.3);
        }

        .cm2--playing .cm2__halo {
          animation: cm2Halo 7s ease-out forwards;
        }

        .cm2__brand {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          opacity: 0;
          transform: translateY(55px) scale(.55);
          filter: blur(25px);
          text-align: center;
          padding: 24px;
        }

        .cm2--playing .cm2__brand {
          animation: cm2Brand 2s cubic-bezier(.16,1,.3,1) 6.9s forwards;
        }

        .cm2__brand svg {
          filter: drop-shadow(0 0 32px rgba(239,185,90,.5));
        }

        .cm2__subtitle {
          color: #dcb878;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: .38em;
        }

        .cm2__tagline {
          color: rgba(255,255,255,.7);
          font-size: clamp(14px,2vw,21px);
          letter-spacing: .08em;
        }

        .cm2__flash {
          position: absolute;
          inset: 0;
          z-index: 4;
          background: #fff0ca;
          opacity: 0;
          pointer-events: none;
        }

        .cm2--playing .cm2__flash {
          animation: cm2Flash 1.1s ease-out 6.9s forwards;
        }

        .cm2__controls {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 24px;
          text-align: center;
          background:
            linear-gradient(90deg, rgba(0,0,0,.12), rgba(0,0,0,.38) 45%, rgba(0,0,0,.08)),
            url("/images/cinematic/cinematch_background_v4.png")
              center center / cover no-repeat,
            #080607;
          overflow: hidden;
        }

        .cm2__controls {
          animation: cm4WelcomeCamera 18s ease-in-out infinite alternate;
        }

        @keyframes cm4WelcomeCamera {
          0% {
            background-size: auto, 100% 100%;
          }
          100% {
            background-size: auto, 108% 108%;
          }
        }
        .cm2__motion-beam {
          position: absolute;
          z-index: 0;
          pointer-events: none;
          width: 150vw;
          height: 42vh;
          left: -30vw;
          top: 24%;
          transform: rotate(-17deg);
          opacity: .62;
          filter: blur(20px);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,190,91,.02) 20%,
            rgba(255,204,119,.24) 48%,
            rgba(255,227,174,.08) 58%,
            transparent 100%
          );
          animation: cm4BeamSweep 9s ease-in-out infinite alternate;
        }

        .cm2__motion-film {
          position: absolute;
          z-index: 0;
          left: -35%;
          width: 170%;
          height: clamp(54px, 9vh, 100px);
          pointer-events: none;
          opacity: .64;
          border-top: 7px dashed rgba(255,205,126,.68);
          border-bottom: 7px dashed rgba(255,205,126,.68);
          background:
            repeating-linear-gradient(
              90deg,
              rgba(255,202,121,.17) 0 100px,
              rgba(255,223,170,.4) 101px 103px,
              rgba(30,17,10,.38) 104px 112px
            );
          box-shadow:
            0 0 24px rgba(255,177,71,.17),
            inset 0 0 24px rgba(255,190,91,.08);
        }

        .cm2__motion-film--top {
          top: 12%;
          transform: rotate(-11deg);
          animation: cm4FilmForward 22s linear infinite;
        }

        .cm2__motion-film--bottom {
          bottom: 11%;
          transform: rotate(9deg);
          animation: cm4FilmBackward 27s linear infinite;
        }

        @keyframes cm4FilmForward {
          from { translate: -5% 0; }
          to { translate: 5% 0; }
        }

        @keyframes cm4FilmBackward {
          from { translate: 5% 0; }
          to { translate: -5% 0; }
        }

        @keyframes cm4BeamSweep {
          0% {
            translate: -8% 0;
            opacity: .28;
          }
          50% {
            opacity: .75;
          }
          100% {
            translate: 8% 0;
            opacity: .4;
          }
        }
        .cm2__controls::before {
          content: "";
          position: absolute;
          width: min(76vw, 820px);
          aspect-ratio: 1;
          border-radius: 50%;
          border: 1px solid rgba(218,175,105,.12);
          box-shadow:
            0 0 100px rgba(44,130,163,.1),
            inset 0 0 90px rgba(218,175,105,.04);
          animation: cm2WelcomeOrbit 16s linear infinite;
          pointer-events: none;
        }

        .cm2__controls::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(
              115deg,
              transparent 0 95px,
              rgba(229,187,117,.035) 96px 97px,
              transparent 98px 190px
            );
          animation: cm2WelcomeDrift 18s linear infinite;
          pointer-events: none;
        }

        .cm2__controls > * {
          position: relative;
          z-index: 1;
        }

        .cm2__welcome {
          text-shadow: 0 8px 55px rgba(0,0,0,.7);
        }

        .cm2__button--primary {
          box-shadow: 0 8px 38px rgba(217,166,86,.22);
        }

        @keyframes cm2WelcomeOrbit {
          from { transform: rotate(0deg) scale(.9); }
          to { transform: rotate(360deg) scale(1.05); }
        }

        @keyframes cm2WelcomeDrift {
          from { transform: translateX(-4%); }
          to { transform: translateX(4%); }
        }
        .cm2__welcome {
          font-size: clamp(32px,6vw,64px);
          font-weight: 800;
          letter-spacing: -.05em;
        }

        .cm2__description {
          max-width: 480px;
          line-height: 1.8;
          color: #b3aa9b;
          font-size: 14px;
        }

        .cm2__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
        }

        .cm2__button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .2s;
        }

        .cm2__button:hover { transform: translateY(-2px); }

        .cm2__button--primary {
          background: #e8b96d;
          color: #090909;
        }

        .cm2__button--secondary {
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.04);
          color: #f3eee5;
        }

        .cm2__skip {
          position: absolute;
          z-index: 12;
          top: 25px;
          right: 25px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 8px;
          background: rgba(0,0,0,.4);
          color: #eee3d0;
          cursor: pointer;
        }

        .cm2__sound {
          position: absolute;
          z-index: 5;
          bottom: 28px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #cbb994;
          font-size: 11px;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        @keyframes cm2Camera {
          from { transform: scale(1); }
          to { transform: scale(1.45) rotate(4deg); }
        }

        @keyframes cm2Beam {
          0% { opacity: 0; transform: rotate(-17deg) translateX(-120%); }
          20% { opacity: 1; }
          80% { opacity: .7; }
          100% { opacity: 0; transform: rotate(-17deg) translateX(120%); }
        }

        @keyframes cm2FilmOne {
          0% { opacity: 0; transform: rotate(-18deg) translateX(-70%); }
          15% { opacity: .9; }
          75% { opacity: .8; }
          100% { opacity: 0; transform: rotate(-18deg) translateX(75%); }
        }

        @keyframes cm2FilmTwo {
          0% { opacity: 0; transform: rotate(17deg) translateX(70%); }
          15% { opacity: .85; }
          75% { opacity: .75; }
          100% { opacity: 0; transform: rotate(17deg) translateX(-75%); }
        }

        @keyframes cm2Halo {
          0% { opacity: 0; transform: scale(.2) rotate(-90deg); }
          45% { opacity: .8; }
          100% { opacity: 0; transform: scale(1.7) rotate(180deg); }
        }

        @keyframes cm2Brand {
          0% {
            opacity: 0;
            transform: translateY(55px) scale(.55);
            filter: blur(25px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes cm2Flash {
          0%, 20% { opacity: 0; }
          40% { opacity: .8; }
          100% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cm2--playing .cm2__film,
          .cm2--playing .cm2__beam,
          .cm2--playing .cm2__halo,
          .cm2--playing .cm2__flash,
          .cm2--playing .cm2__backdrop {
            animation: none;
          }

          .cm2--playing .cm2__brand {
            animation: none;
            opacity: 1;
            transform: none;
            filter: none;
          }
        }
      `}</style>

      <div className="cm2__backdrop" />
      <div className="cm2__beam" />

      <div className="cm2__film cm2__film--one">
        {Array.from({ length: 18 }, (_, i) => (
          <span className="cm2__frame" key={i} />
        ))}
      </div>

      <div className="cm2__film cm2__film--two">
        {Array.from({ length: 18 }, (_, i) => (
          <span className="cm2__frame" key={i} />
        ))}
      </div>

      <div className="cm2__halo" />

      <div className="cm2__brand">
        <CineMatchLogo
          size={110}
          showWordmark
          className="flex-col !gap-5"
        />
        <div className="cm2__subtitle">
          A cinematic intelligence experience
        </div>
        <div className="cm2__tagline">
          Where every story finds you.
        </div>
      </div>

      <div className="cm2__flash" />

      {!started && (
        <div className="cm2__controls">
          <div className="cm2__motion-beam" aria-hidden="true" />
          <div className="cm2__motion-film cm2__motion-film--top" aria-hidden="true" />
          <div className="cm2__motion-film cm2__motion-film--bottom" aria-hidden="true" />
          <div className="text-xs uppercase tracking-[0.4em] text-[#d9a64e]">
            A New Cinema Experience
          </div>

          <div className="cm2__welcome">
            Welcome to <span className="text-[#e6b665]">CineMatch</span>
          </div>

          <p className="cm2__description">
            Khám phá thế giới điện ảnh được cá nhân hóa bằng
            Machine Learning với trải nghiệm mở màn dành riêng
            cho CineMatch.
          </p>

          <div className="cm2__actions">
            <button
              type="button"
              onClick={() => start(true)}
              className="cm2__button cm2__button--primary"
            >
              <Volume2 size={17} />
              Bật âm thanh & Bắt đầu
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => start(false)}
              className="cm2__button cm2__button--secondary"
            >
              <VolumeX size={17} />
              Xem không âm thanh
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="cm2__skip"
        onClick={finish}
        aria-label="Bỏ qua intro"
      >
        Bỏ qua <X size={15} />
      </button>

      {started && (
        <div className="cm2__sound">
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          Cinematic Experience
        </div>
      )}
    </div>
  );
}



