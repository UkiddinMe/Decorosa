// Pictures drawn inside an SVG can't take a srcset, so this does its job: an
// `<svg data-sized="<ref>">` (ref: the long side of its first picture, which is also the
// SVG's own unit grid) has every `<image data-src>` in it pointed at the smallest copy
// (src/data/images.ts) at least as big as the SVG is drawn — one copy for all of them,
// so an artwork and its moving parts stay in step. Only the files change: every box,
// mask and move is in the SVG's units. Runs before the page fades in (the swapped
// images hold back `load`), again after each client-side navigation, and on resize —
// which only ever moves up a size.
import { levels, sizedSrc } from '../data/images';

/** room for the swell and hover scale the pieces get once drawn */
const HEADROOM = 1.2;

function size(svg: SVGSVGElement): void {
  const ref = Number(svg.dataset.sized);
  const box = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !box?.width) return;
  // the drawn size of one unit — `meet`, so the tighter axis
  const unit = Math.min(rect.width / box.width, rect.height / box.height);
  const need = ref * unit * devicePixelRatio * HEADROOM;
  const level = levels(ref).find((l) => l >= need) ?? ref;
  if (level <= Number(svg.dataset.level ?? levels(ref)[0] ?? ref)) return;
  svg.dataset.level = String(level);
  for (const img of svg.querySelectorAll<SVGImageElement>('image[data-src]')) {
    const src = img.dataset.src!;
    img.setAttribute('href', level === ref ? src : sizedSrc(src, level));
  }
}

const sizeAll = (): void => document.querySelectorAll<SVGSVGElement>('svg[data-sized]').forEach(size);

let frame = 0;
sizeAll();
document.addEventListener('astro:after-swap', sizeAll);
window.addEventListener('resize', () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(sizeAll);
});
