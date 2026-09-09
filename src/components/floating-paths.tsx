/**
 * Decorative animated line-field for the landing hero. Adapted from the 21st.dev
 * "Background Paths" component and tuned for our dark palette.
 *
 * Perf: the original animated pathLength/pathOffset on 72 SVG paths every frame,
 * which churns stroke-dasharray and re-rasterizes the SVG continuously — that
 * janked the whole page (and made the hero text look like it jittered). Here the
 * paths are STATIC and the whole field gets one GPU-composited drift (a single
 * transform on the container), so there is zero per-path per-frame work.
 * aria-hidden + pointer-events-none: purely decorative, never traps focus.
 */
function PathField({ position }: { position: number }) {
  const paths = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 12}C-${380 - i * 5 * position} -${189 + i * 12} -${312 - i * 5 * position} ${216 - i * 12} ${152 - i * 5 * position} ${343 - i * 12}C${616 - i * 5 * position} ${470 - i * 12} ${684 - i * 5 * position} ${875 - i * 12} ${684 - i * 5 * position} ${875 - i * 12}`,
    width: 0.6 + i * 0.06,
    opacity: 0.08 + i * 0.03,
  }));

  return (
    <svg className="absolute inset-0 h-full w-full text-white" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
      {paths.map((p) => (
        <path key={p.id} d={p.d} stroke="currentColor" strokeWidth={p.width} strokeOpacity={p.opacity} />
      ))}
    </svg>
  );
}

export function FloatingPaths() {
  return (
    <div
      className="absolute inset-0 animate-drift pointer-events-none will-change-transform [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
      aria-hidden
    >
      <PathField position={1} />
      <PathField position={-1} />
    </div>
  );
}
