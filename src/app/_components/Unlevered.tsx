"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GraduationCap, ChartBar } from "kubai-icons-react/duotone";
import { Layers, Globe, Database } from "kubai-icons-react/line";
import Image from "next/image";
import { useRef, useState } from "react";
import unleveredLogo from "../../../public/unlevered/unlevered_logo.jpeg";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const HIGHLIGHTS = [
  {
    Icon: Database,
    title: "AI Prompt Cache reducing 3% token usage",
    description:
      "Stored retrieved financial filing summary responses into MongoDB so future requests can be served by the cache directly.",
  },
  {
    Icon: Layers,
    title: "AI Prompt chunking for financial filing summaries",
    description:
      "Chunked SEC filings by their sections, decreasing load by 60% and reducing context window usage by 70%.",
  },
  {
    Icon: Globe,
    title: "Client side caching decreasing 13% back-end API calls",
    description:
      "Cached fetched financial data on the browser which eliminated 700ms of additional fetch latency.",
  },
];

/**
 * An asymmetric two-column feature row: a narrower, vertically centered text
 * column on the left, a wide product video on the right. Stacks on
 * small screens.
 */
export default function Unlevered() {
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
      <div className="grid items-center gap-12 md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] md:gap-x-20 lg:gap-x-28">
        <video
          src="/unlevered/Unlevered%20Product%20Showcase.mp4"
          aria-label="Unlevered product showcase"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-auto w-full rounded-[clamp(24px,4.2vw,60px)] [corner-shape:squircle] object-cover md:order-2"
        />
        <div ref={textRef} className="flex flex-col gap-4 md:order-1">
          <h2 className="font-aeonik-regular text-[clamp(1.5rem,2vw,3rem)] leading-[1.2] tracking-tight">
            <Image
              src={unleveredLogo}
              alt=""
              aria-hidden
              className="mr-[0.2em] inline-block size-[1em] rounded-[22%] object-cover align-[-0.2em] mix-blend-multiply saturate-0"
            />
            <span className="text-neutral-500">Unlevered </span>{" "}
            <span className="text-neutral-400">
              {" "}
              is an AI-powered financial research{" "}
              <GraduationCap
                size="1em"
                color="#4c0519"
                trigger="none"
                hover={nfcOn}
                data-switch-on="nfc"
                className="work-icon inline-block align-[-0.2em]"
              />{" "}
              platform for retail investors{" "}
              <ChartBar
                size="1em"
                color="#022c22"
                trigger="none"
                hover={nfcOn}
                data-switch-on="nfc"
                className="work-icon inline-block align-[-0.2em]"
              />{" "}
              to analyze SEC filings, Earnings Call Transcripts and Investor
              Relations Reports.
            </span>
          </h2>
          <p className="font-aeonik-regular text-[clamp(1rem,1.15vw,1.5rem)] leading-relaxed tracking-tight text-neutral-500">
            Software Engineer Intern | Jul. 2024 - Jan. 2025
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
