"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CreditCard, IdBadge, AlarmClock } from "kubai-icons-react/duotone";
import { Code, GitPullRequest, Mails } from "kubai-icons-react/line";
import Image from "next/image";
import { useRef, useState } from "react";
import blitzLogo from "../../../public/blitz/blitz_logo.jpeg";
import dashboard from "../../../public/blitz/dashboard.png";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const HIGHLIGHTS = [
  {
    Icon: Code,
    title: "Rebuilt 100+ pages for app migration",
    description:
      "Led strangler-fig front-end migration which maintained 99.9% uptime while rebuilding every page from scratch.",
  },
  {
    Icon: GitPullRequest,
    title: "Implemented internal Agent Code-Reviews",
    description:
      "Connected LLM Agent reviewer within CI pipeline on incoming pull requests helping reduce code reviews by 2 days.",
  },
  {
    Icon: Mails,
    title: "AI Classification layer identifying 8% more paid opportunities",
    description:
      "Identified 8% more paid sponsorships for creator inboxes, routing collaboration offers into an AI Negotiator Agent.",
  },
];

/**
 * An asymmetric two-column feature row: a wide product screenshot on the
 * left, a narrower, vertically centered text column on the right. Stacks on
 * small screens.
 */
export default function Blitz() {
  const textRef = useRef<HTMLDivElement>(null);
  // Each icon plays its motion once, as it pops in, then holds the end pose.
  const [nfcOn, setNfcOn] = useState(false);
  const [badgeOn, setBadgeOn] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      const switchOn: Record<string, () => void> = {
        nfc: () => setNfcOn(true),
        badge: () => setBadgeOn(true),
      };

      media.add("(prefers-reduced-motion: reduce)", () => {
        Object.values(switchOn).forEach((on) => on());
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: textRef.current,
            start: "top 80%",
            once: true,
          },
        });
        gsap.utils
          .toArray<SVGSVGElement>(".work-icon", textRef.current)
          .forEach((el, i) => {
            tl.fromTo(
              el,
              { scale: 0, rotate: -18, opacity: 0 },
              {
                scale: 1,
                rotate: 0,
                opacity: 1,
                duration: 0.55,
                ease: "back.out(2.4)",
              },
              0.2 + i * 0.35,
            );
            const on = el.dataset.switchOn && switchOn[el.dataset.switchOn];
            if (on) tl.call(on, [], 0.2 + i * 0.35 + 0.35);
          });
        return () => tl.scrollTrigger?.kill();
      });

      return () => media.revert();
    },
    { scope: textRef },
  );

  return (
    <section className="w-full px-6 py-24 sm:px-12 lg:px-20 2xl:px-32">
      <div className="grid items-center gap-12 md:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] md:gap-x-20 lg:gap-x-28">
        <div className="relative isolate overflow-hidden rounded-[clamp(24px,4.2vw,60px)] [corner-shape:squircle] bg-[#e9defb] p-8 sm:p-12 lg:p-16">
          {/* Decorative animated backdrop; the screenshot floats above it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
          >
            <span className="absolute -left-[10%] -top-[10%] size-[65%] rounded-full bg-[#c9b3f5] motion-safe:animate-[showcase-drift-a_14s_ease-in-out_infinite]" />
            <span className="absolute -bottom-[15%] -right-[10%] size-[70%] rounded-full bg-[#f0d9fb] motion-safe:animate-[showcase-drift-b_18s_ease-in-out_infinite]" />
            <span className="absolute left-[30%] top-[35%] size-[45%] rounded-full bg-[#b9c4f7] motion-safe:animate-[showcase-drift-c_22s_ease-in-out_infinite]" />
          </div>
          <div className="relative mx-auto w-full max-w-[88%]">
            <Image
              src={dashboard}
              alt="Blitz dashboard interface"
              sizes="(min-width: 768px) 65vw, 100vw"
              className="h-auto w-full rounded-[clamp(12px,2.1vw,30px)] [corner-shape:squircle] shadow-[0_10px_40px_-8px_rgba(0,0,0,0.10)]"
            />
          </div>
        </div>
        <div ref={textRef} className="flex flex-col gap-4">
          <h2 className="font-aeonik-regular text-[clamp(1.5rem,2vw,3rem)] leading-[1.2] tracking-tight">
            <Image
              src={blitzLogo}
              alt=""
              aria-hidden
              className="mr-[0.2em] inline-block size-[1em] rounded-[22%] object-cover align-[-0.2em] mix-blend-multiply saturate-0"
            />
            <span className="text-neutral-500">Blitz </span>{" "}
            <span className="text-neutral-400">
              {" "}
              is the payment platform{" "}
              <CreditCard
                size="1em"
                color="#042f2e"
                trigger="none"
                hover={nfcOn}
                data-switch-on="nfc"
                className="work-icon inline-block align-[-0.2em]"
              />{" "}
              that helps 1099 contractors{" "}
              <IdBadge
                size="1em"
                color="#4c0519"
                trigger="none"
                hover={badgeOn}
                data-switch-on="badge"
                className="work-icon inline-block align-[-0.2em]"
              />{" "}
              get paid faster{" "}
              <AlarmClock
                size="1em"
                color="#422006"
                trigger="none"
                hover={badgeOn}
                data-switch-on="badge"
                className="work-icon inline-block align-[-0.2em]"
              />{" "}
              instead of chasing invoices.
            </span>
          </h2>
          <p className="font-aeonik-regular text-[clamp(1rem,1.15vw,1.5rem)] leading-relaxed tracking-tight text-neutral-500">
            Software Engineer Intern | Mar. 2026 - Sep. 2026
          </p>
        </div>
      </div>
      <div className="mt-[7.5dvh] grid grid-cols-1 gap-x-12 gap-y-14 md:grid-cols-3">
        {HIGHLIGHTS.map(({ Icon, title, description }) => (
          <div key={title} className="flex flex-col gap-6">
            <Icon size="2.5rem" color="#404040" trigger="none" aria-hidden />
            <h3 className="font-aeonik-regular text-[clamp(1.5rem,2vw,2.25rem)] leading-[1.15] tracking-tight text-neutral-500">
              {title}
            </h3>
            <p className="font-aeonik-regular text-[clamp(0.875rem,1.15vw,1.125rem)] leading-relaxed tracking-tight text-neutral-400">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
