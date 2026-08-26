"use client";

import { AnimatePresence, motion } from "motion/react";

function DescriptionContent({ type }: { type: string }) {
  switch (type) {
    case "Unlevered":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">Unlevered</h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I worked as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            from July 2024 - Jan 2025. I built the front-end infrastructure for
            Unlevered, integrating back-end services to manage and display AI
            summaries to help financial analysts and investors review SEC
            filings, investor relations reports, and earnings transcripts.
          </p>
        </header>
      );
    case "Blitz":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">Blitz</h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I'm currently working here as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            since March of this year. I've rebuilt the entire front-end UI of
            the Blitz platform from the ground up which linked to back-end
            services to transfer millions in payouts to thousands of users.
          </p>
        </header>
      );
    case "Syllabus to Calendar":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">
            Syllabus to Calendar
          </h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            Personal project of mine which I used to parse course syllabi
            deadlines and events to automatically sync to my Google Calendar.
            Learned about token optimization and prompt engineering with AI
            models.
          </p>
        </header>
      );
    default:
      return null;
  }
}

export default function WorkDescriptions({ type }: { type: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={type}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <DescriptionContent type={type} />
      </motion.div>
    </AnimatePresence>
  );
}
