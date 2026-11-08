---
title: About Ray Chu
---

# About Ray Chu

Ray Chu is a Software Engineer based in New York City who specializes in building with careful UI design. He is a Computer Science student at Hunter College and has completed two software engineering internships, at Blitz and Unlevered. His site is raychu.info.

## Links

- Website: https://raychu.info
- LinkedIn: https://www.linkedin.com/in/raychu83/
- GitHub: https://github.com/RayChu83
- Resume: https://raychu.info/Ray_Chu_Resume.pdf

## Education

### Hunter College

Ray is pursuing a B.A. in Computer Science with a Minor in Math at Hunter College in New York, NY, from August 2025 to the present.

- He is 1 of 41 Computer Science Scholars representing the Class of 2029.
- Relevant coursework: Data Structures and Algorithms, Software Analysis and Design, Discrete Structures, and Intro to Computer Science.

## Experience

### Software Engineer Intern at Blitz (Mar 2026 – Sep 2026)

Blitz is backed by Antler S26 and is based in New York, NY (https://useblitz.co). Ray worked there as a Software Engineer Intern, rebuilding a payouts platform's front end. His work included:

- Built an internal Automated Code Review CI pipeline that decreased code review times by 2 days. It connects an LLM agent that reviews pull requests as they are opened, summarizes them, and comments suggested changes.
- Developed an LLM-driven email classification layer that identified 8% more possible brand deals across 70 creators. It replaced a deterministic keyword-regex email scorer.
- Created an idempotent database backfill migration that mapped account manager IDs from a legacy free-text field without schema constraints into a normalized schema. It backfilled 65 user records across two live databases.
- Led the front-end user interface development during a Next.js 16 migration, which reduced bounce rates by 16%.

### Software Engineer Intern at Unlevered (Jul 2024 – Jan 2025)

Unlevered is based in New York, NY. Ray worked there as a Software Engineer Intern building AI summaries for financial filings. His work included:

- Implemented database caching for existing AI-parsed financial summaries. This decreased token consumption by 3% the following month and reduced summary fetching from 30s to 200ms.
- Increased AI-summary processing speeds by 60% by decoupling a single prompt workload into 7 parallel chunked LLM calls. The first summary content streamed 15% faster than waiting for the whole summary.
- Improved fetch response time by 42% by implementing server-side pagination for filing search results. This shrank payload sizes by 85% and limited results to 10 per page.
- Eliminated 700ms of fetch latency by implementing client-side caching for already fetched financial data. This reduced redundant API calls by 13% across page navigation.

## Projects

### Syllabus to Calendar

Tech: Next.js, TypeScript, Supabase, LangChain. Live at https://syllabustocalendar.com. It is a personal project that turns college syllabus PDFs into Google Calendar events.

- Built a platform used by 40 students that automates manual calendar entry. An LLM parses uploaded PDF syllabi to generate student deadlines, which sync to their Google Calendar.
- Developed an idempotent syllabus upload that hashes new PDF uploads and caches their extracted deadlines. This prevents duplicate syllabi from re-calling the LLM for deadline extraction.
- Cut AI parsing costs by 20–30% by preprocessing raw PDF-extracted text before sending it to the LLM. Repeated headers, footers, and whitespace are stripped, which directly reduces input tokens on every uncached request.

## Technical Skills

- Languages: JavaScript, TypeScript, Python, C++, HTML, CSS
- Frameworks: React.js, Next.js, Redux, MobX, TailwindCSS, Material UI, Framer Motion, GSAP
- Developer tools: MongoDB, DynamoDB, Firebase, Supabase, RESTful APIs
- Libraries and platforms: AWS, Azure, Docker, Doppler, GitHub, Figma, Adobe Photoshop

## About This Portfolio

The portfolio at raychu.info is built with Next.js, React, TypeScript, and Tailwind CSS, with GSAP for animation. It features a hero with a dotted world map, a scroll-pinned work section that showcases Blitz, Unlevered, and Syllabus to Calendar with product videos, and social links. It respects reduced-motion preferences and includes structured data so search engines can connect the site to Ray's LinkedIn and GitHub profiles.
