## IMPORTANT: Sound Notification

After finishing responding to my request or running a command, run this command to notify me by sound (Windows / PowerShell):

```powershell
[console]::beep(880,150); [console]::beep(1175,200)
```

## IMPORTANT: Keep documentation updated

The project documentation lives in `docs/ARCHITECTURE.md` and `docs/ANIMATIONS.md`.
After every significant edit (new/removed files, changed behavior, changed animation
mechanics, new content workflow), update the relevant doc sections so they stay
accurate. Keep them concise — same level of detail they have now.


## IMPORTANT: KEEP THE CODEBASE CLEAN

After each request, if any parts of code happen not to be necessary anymore, get rid of those, to keep the codebase clean and maintainable.


## Keep answers concise

Please keep your answers more concise than you normally would. Don't be as verbose as you normally would be.

## IMPORTANT: Never invent copy

All user-facing text on the site is the owner's to write. Never invent headings,
intros, taglines or body copy — use Lorem Ipsum / obviously generic placeholders in
`src/data/i18n/{it,en}.ts`, keeping the shape (line count, length) the layout expects.
Functional UI labels (buttons, form fields, nav) are fine as plain words.
