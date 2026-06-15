// Hero section layout and content controls live in this file.
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  CreditCard,
  PackageCheck,
  Play,
  RefreshCcw,
  Sparkles,
  UserRoundCog,
  Zap,
} from "lucide-react";

import { homepageAssets } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/Button";
import { ChatPreview } from "./chat-preview";
import { HomepageContainer } from "./container";

// Controls the checklist items shown below the hero description.
const heroHighlights = [
  "ตอบแชทไว ไม่พลาดทุกโอกาสขาย",
  "AI เรียนรู้ร้านคุณ แนะนำสินค้าแบบตรงใจ",
  "เชื่อมต่อ LINE OA ภายในไม่กี่นาที",
  "เพิ่มยอดขายอัตโนมัติ ด้วย AI อัจฉริยะ",
];

// Controls the trust badges shown below the CTA buttons.
const trustPoints = [
  {
    icon: CreditCard,
    label: "ไม่ต้องใช้บัตรเครดิต",
  },
  {
    icon: RefreshCcw,
    label: "ยกเลิกได้ตลอดเวลา",
  },
  {
    icon: Zap,
    label: "ใช้งานได้ทันที",
  },
];

// Controls the floating feature cards around the mascot on desktop.
const capabilityCards = [
  {
    className: "left-[7%] top-[5%]",
    icon: Zap,
    title: "ตอบไว",
    subtitle: "ภายใน 3 วินาที",
  },
  {
    className: "right-[14%] top-[9%] w-[240px]",
    icon: BrainCircuit,
    title: "Customer Memory",
    subtitle: "จดจำลูกค้า เข้าใจบทสนทนา",
  },
  {
    className: "left-[2%] bottom-[19%] w-[238px]",
    icon: PackageCheck,
    title: "Stock Realtime",
    subtitle: "เช็กสต๊อกแบบเรียลไทม์",
  },
  {
    className: "right-[10%] bottom-[9%] w-[238px]",
    icon: UserRoundCog,
    title: "Human Handover",
    subtitle: "ส่งต่อแอดมินได้ทันที",
  },
];

const desktopParticles = [
  "left-[17%] top-[17%] h-[4px] w-[4px] bg-emerald-300/70 blur-sm",
  "left-[23%] bottom-[24%] h-[3px] w-[3px] bg-emerald-400/60 blur-sm",
  "left-[50%] top-[14%] h-[3px] w-[3px] bg-emerald-300/70 blur-sm",
  "left-[59%] bottom-[16%] h-[4px] w-[4px] bg-emerald-300/60 blur-sm",
  "right-[23%] top-[19%] h-[3px] w-[3px] bg-emerald-400/70 blur-sm",
  "right-[20%] bottom-[19%] h-[2px] w-[2px] bg-emerald-300/70 blur-sm",
] as const;

const mobileParticles = [
  "left-[18%] top-[16%] h-[4px] w-[4px] bg-emerald-300/70 blur-sm",
  "left-[24%] bottom-[24%] h-[3px] w-[3px] bg-emerald-400/60 blur-sm",
  "right-[20%] top-[18%] h-[4px] w-[4px] bg-emerald-300/70 blur-sm",
  "right-[21%] bottom-[20%] h-[2px] w-[2px] bg-emerald-300/70 blur-sm",
] as const;

// Reusable card UI for each floating desktop capability highlight.
function CapabilityCard({
  className,
  icon: Icon,
  title,
  subtitle,
}: {
  className?: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-30 w-[224px] rounded-[24px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_18px_48px_rgba(15,23,42,0.09)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-success">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-slate-950">
            {title}
          </div>
          <div className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function FloatingParticles({ particles }: { particles: readonly string[] }) {
  return (
    <>
      {particles.map((particle, index) => (
        <div key={index} className={cn("pointer-events-none absolute z-20 rounded-full", particle)} />
      ))}
    </>
  );
}

function ChatPlatform({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "chat-platform pointer-events-none absolute inset-x-1/2 -translate-x-1/2",
        compact ? "bottom-[-18px] h-[84px] w-[280px]" : "bottom-[-22px] h-[90px] w-[300px]",
        className,
      )}
    >
      <div
        className={cn(
          "absolute rounded-full bg-emerald-300/24 blur-xl",
          compact ? "inset-x-5 bottom-2 h-7" : "inset-x-6 bottom-3 h-8",
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-full border border-emerald-200/35 bg-white/38",
          compact ? "h-[84px]" : "h-[90px]",
        )}
      />
      <div
        className={cn(
          "absolute rounded-full border border-emerald-200/70 bg-white/88 shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
          compact ? "inset-x-4 bottom-3 h-11" : "inset-x-4 bottom-4 h-12",
        )}
      />
    </div>
  );
}

// Decorative orbit lines behind the desktop hero visual.
function OrbitDecor() {
  return (
    <>
      <div className="pointer-events-none absolute left-[39%] top-[47%] z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/40" />
      <div className="pointer-events-none absolute left-[39%] top-[47%] z-10 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/30" />
      <div className="pointer-events-none absolute left-[39%] top-[47%] z-10 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/20" />
    </>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-1 pt-4 lg:pt-6" id="home">
      {/* Controls the soft green background glow for the whole hero section. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(circle_at_58%_42%,rgba(220,252,231,0.88)_0%,rgba(240,253,244,0.5)_36%,rgba(255,255,255,0)_68%)]" />

      <HomepageContainer className="max-w-[1500px] lg:w-[86vw]">
        <div className="grid items-center gap-12 lg:grid-cols-[42%_58%]">
          {/* Left content column: badge, title, description, checklist, CTA, and trust points. */}
          <div className="relative z-10">
            {/* Controls the small badge above the main headline. */}
            <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-white/90 px-5 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-success shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <Sparkles className="size-4" />
              AI Commerce Assistant
            </div>

            {/* Controls the main hero headline. */}
            <h1 className="mt-7 max-w-[560px] text-[48px] font-black leading-[0.98] tracking-[-0.03em] text-slate-950 sm:text-[58px] lg:text-[64px]">
              <span className="block">AI ผู้ช่วยตอบแชท</span>
              <span className="mt-1 block">
                ที่{" "}
                <span className="bg-gradient-to-r from-success via-emerald-500 to-lime-500 bg-clip-text text-transparent">
                  เข้าใจร้านของคุณ
                </span>
              </span>
            </h1>

            {/* Controls the supporting paragraph below the headline. */}
            <p className="mt-6 max-w-[560px] text-lg leading-8 text-slate-500">
              ตอบลูกค้าได้อัตโนมัติ 24 ชั่วโมง ไม่พลาดทุกการขาย เพิ่มยอดขาย
              ลดงาน 
              แอดมิน ด้วย AI อัจฉริยะ
            </p>

            {/* Controls the checklist generated from heroHighlights. */}
            <div className="mt-8 grid gap-3.5">
              {heroHighlights.map((item) => (
                <div key={item} className="flex items-start gap-3.5 text-slate-700">
                  <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-[0_8px_18px_rgba(34,197,94,0.25)]">
                    <Check className="size-3.5" />
                  </div>
                  <span className="text-base leading-7">{item}</span>
                </div>
              ))}
            </div>

            {/* Controls the primary and secondary CTA buttons. */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className={cn(
                  buttonVariants({ size: "default", variant: "default" }),
                  "h-14 min-w-[270px] rounded-[18px] px-7 text-base font-semibold shadow-[0_18px_40px_rgba(34,197,94,0.24)]",
                )}
                href="/register"
              >
                <span className="flex items-center gap-4">
                  เริ่มต้นใช้งานฟรี 14 วัน
                  <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                    <ArrowRight className="size-4" />
                  </span>
                </span>
              </Link>

              <Link
                className={cn(
                  buttonVariants({ size: "default", variant: "outline" }),
                  "h-14 min-w-[170px] rounded-[18px] border-slate-200 bg-white px-7 text-base font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.04)]",
                )}
                href="#how-it-works"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-success text-white">
                    <Play className="size-3.5 fill-current" />
                  </span>
                  ดู Demo
                </span>
              </Link>
            </div>

            {/* Controls the trust badges generated from trustPoints. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-slate-500">
              {trustPoints.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <Icon className="size-[18px] text-success" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop-only visual column: mascot, premium effects, and chat preview. */}
          <div className="relative hidden h-[650px] lg:block">
            <div className="pointer-events-none absolute left-[39%] top-[47%] z-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/50 blur-[96px]" />
            <OrbitDecor />
            <FloatingParticles particles={desktopParticles} />

            <div className="pointer-events-none absolute left-[39%] top-[47%] z-40 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/8 blur-[72px]" />

            {capabilityCards.map((card) => (
              <CapabilityCard key={card.title} {...card} />
            ))}

            <img
              alt="Chatto mascot"
              className="absolute left-[39%] top-[47%] z-50 w-[530px] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_40px_70px_rgba(34,197,94,0.22)]"
              src={homepageAssets.heroMascot}
            />

            <div className="pointer-events-none absolute bottom-[10.8%] left-[39%] z-[55] h-11 w-[370px] -translate-x-1/2 rounded-full bg-emerald-300/24 blur-2xl" />
            <div className="pointer-events-none absolute bottom-[10.4%] left-[39%] z-[55] h-[64px] w-[430px] -translate-x-1/2 rounded-full border border-emerald-200/35 bg-white/36" />
            <div className="pointer-events-none absolute bottom-[10.7%] left-[39%] z-[60] h-[44px] w-[360px] -translate-x-1/2 rounded-full border border-emerald-200/72 bg-white/88 shadow-[0_18px_36px_rgba(15,23,42,0.07)]" />

            <div className="absolute right-[-18%] top-[50%] z-[45] w-[320px] -translate-y-1/2 scale-[0.88] xl:right-[-17%] 2xl:right-[-16%]">
              <div className="pointer-events-none absolute inset-[-14px] rounded-[56px] bg-emerald-200/16 blur-2xl" />
              <ChatPlatform />
              <div className="relative z-10 drop-shadow-[0_30px_42px_rgba(15,23,42,0.16)]">
                <ChatPreview className="w-full ring-2 ring-emerald-200/60 shadow-[0_0_36px_rgba(34,197,94,0.14),0_26px_60px_rgba(15,23,42,0.12)]" />
              </div>
            </div>
          </div>

          {/* Mobile-only visual stack with the same premium layers in a compact layout. */}
          <div className="relative mx-auto flex w-full max-w-[430px] flex-col items-center gap-5 lg:hidden">
            <div className="relative flex w-full items-center justify-center pb-8 pt-4">
              <div className="pointer-events-none absolute left-1/2 top-[47%] z-0 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/55 blur-[76px]" />
              <div className="pointer-events-none absolute left-1/2 top-[47%] z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/40" />
              <div className="pointer-events-none absolute left-1/2 top-[47%] z-10 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/30" />
              <div className="pointer-events-none absolute left-1/2 top-[47%] z-10 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/20" />
              <FloatingParticles particles={mobileParticles} />
              <div className="pointer-events-none absolute left-1/2 top-[47%] z-40 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/8 blur-[56px]" />

              <img
                alt="Chatto mascot"
                className="relative z-50 w-[310px] drop-shadow-[0_32px_50px_rgba(34,197,94,0.18)]"
                src={homepageAssets.heroMascot}
              />

              <div className="pointer-events-none absolute bottom-[4%] left-1/2 z-[55] h-10 w-[250px] -translate-x-1/2 rounded-full bg-emerald-300/22 blur-2xl" />
              <div className="pointer-events-none absolute bottom-[3.8%] left-1/2 z-[55] h-[54px] w-[300px] -translate-x-1/2 rounded-full border border-emerald-200/35 bg-white/34" />
              <div className="pointer-events-none absolute bottom-[4.4%] left-1/2 z-[60] h-10 w-[245px] -translate-x-1/2 rounded-full border border-emerald-200/72 bg-white/86 shadow-[0_16px_32px_rgba(15,23,42,0.07)]" />
            </div>

            <div className="relative z-[70] w-full max-w-[340px]">
              <div className="pointer-events-none absolute inset-[-12px] rounded-[46px] bg-emerald-200/16 blur-2xl" />
              <ChatPlatform compact />
              <div className="relative z-10 drop-shadow-[0_24px_34px_rgba(15,23,42,0.14)]">
                <ChatPreview className="w-full ring-2 ring-emerald-200/60 shadow-[0_0_34px_rgba(34,197,94,0.14),0_24px_56px_rgba(15,23,42,0.12)]" />
              </div>
            </div>
          </div>
        </div>
      </HomepageContainer>
    </section>
  );
}
