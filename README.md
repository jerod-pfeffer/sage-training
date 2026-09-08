# Sage Training — Block planner

A small GitHub Pages app that lays out each training block as a week you can rearrange. Same architecture as the TB2 schedule app: the plan lives in the repo, the page reads it from there, and a fine-grained token kept on the phone lets the app save back.

## Files

| File | What it is | Who writes it |
|---|---|---|
| `index.html`, `app.css`, `app.js`, `ui.js` | The app (markup, styles, core logic, rendering) | — |
| `program.json` | Every block, in order. Block 1 is already in it | Claude produces each new block; you paste it in the app |
| `state.json` | Day moves, check-offs, and notes | The app |
| `icon.png` | Home-screen icon | — |

## Setup

1. The app is served from `https://jerod-pfeffer.github.io/sage-training/`.
2. **Token:** the app needs a token that can write to *this* repo only. On github.com: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Repository access: *Only select repositories* → `sage-training`. Permissions → Repository permissions → **Contents: Read and write**. Longest expiration offered.
3. **On the phone:** open the URL in Safari → Share → **Add to Home Screen**. Open it, tap ⚙, paste the token, Save. The status line at the bottom should read *Synced*.

## Using it

- **Week spine:** each row is a day. Today is marked on the left rail. Tap a card for that day's sessions; tap a session for this week's exact prescription, a **Mark done** button, and a notes box for loads and how it felt.
- **Moving days:** drag the handle on the right of a row onto another row to swap the two days, or open a day and use **Move this day**. The whole day travels. Changes apply to that one week only; **Reset week to plan** puts it back.
- **Block view:** tap the week strip at the top (or the list icon) for the block's intro, week-by-week focus, rules, default week, baselines, and recovery notes.
- **Sync:** every change commits to `state.json`. Offline, the app opens from its last saved copy and saves next time it can reach GitHub.

## Adding the next block

Ask for the next block **as block JSON**. Copy it, open the app → ⚙ → *Add the next block* → paste → **Add block**. A block with the same `id` replaces the earlier version. `program.json` is the reference example of the format.
