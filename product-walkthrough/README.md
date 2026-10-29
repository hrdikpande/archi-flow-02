# DrawingOps · complete product walkthrough

A narrated, client-facing video of the whole intended DrawingOps product, recorded in the interactive prototype (`demo/`), plus the inventories and audit behind it. A 12-minute cut with burned-in subtitles is in [`short/`](short/README.md).

| File | What it is |
|---|---|
| [`complete-product-walkthrough.mp4`](complete-product-walkthrough.mp4) | The video: 1920×1080, 30 fps, H.264 + AAC, English narration, soft English subtitles, 22 chapter markers |
| [`complete-product-walkthrough.srt`](complete-product-walkthrough.srt) | The subtitles as a separate file (for players or platforms that need one) |
| [`chapters.txt`](chapters.txt) | Chapter timestamps (paste into YouTube/Vimeo descriptions) |
| [`product-overview.md`](product-overview.md) | What the software is for, who uses it, modules, main workflow, honest status |
| [`feature-inventory.md`](feature-inventory.md) | Every discovered feature and sub-feature |
| [`role-permission-matrix.md`](role-permission-matrix.md) | What each role sees and can do, and what it cannot |
| [`route-inventory.md`](route-inventory.md) | Every route and screen, with who can open it and where the video shows it |
| [`workflow-inventory.md`](workflow-inventory.md) | End-to-end workflows across roles |
| [`video-storyboard.md`](video-storyboard.md) | Chapter order, screens, on-screen actions and narration, with times |
| [`narration-script.md`](narration-script.md) | The complete narration in video order, with times |
| [`coverage-report.md`](coverage-report.md) | Feature-by-feature audit: demonstrated, simulated, shown, explained only, or excluded |
| [`short/`](short/README.md) | **The 12-minute cut**: every part in brief, the core in detail, plus email and how the roles work together; subtitles burned in |
| [`pipeline/`](pipeline/README.md) | Scripts that reproduce both videos from the demo |

## Before sending it to a client

- The video says clearly that it was recorded in the interactive prototype with fictional data, and which outside connections (Microsoft sign-in, email, Revit/AutoCAD plugins, file storage, accounting, forecasting models) are simulated. Keep that framing in any covering email.
- It does not claim a production deployment, real customer outcomes or measured performance. See `product-overview.md` › *Status of the software*.
- No real people, firms, credentials or customer data appear. Demo-only controls (the Demo button and the Demo Access panel with prototype passwords) are hidden in the footage; the sign-in step types a fictional prototype password that is masked on screen.
- The voice is synthetic (Kokoro-82M, Apache-2.0). If you prefer a human voice-over, `narration-script.md` is ready to record and the timings are in `video-storyboard.md`.
