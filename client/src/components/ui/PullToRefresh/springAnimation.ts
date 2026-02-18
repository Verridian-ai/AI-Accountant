/**
 * Spring physics animation for smooth pull-to-refresh transitions.
 * Returns a cancel function to stop the animation early.
 */
export function springAnimation(
  from: number,
  to: number,
  velocity: number,
  callback: (value: number) => void,
  onComplete?: () => void,
): () => void {
  const stiffness = 400;
  const damping = 35;
  const mass = 1;

  let position = from;
  let vel = velocity;
  let lastTime = performance.now();
  let animationFrame: number;

  const step = (currentTime: number) => {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.064);
    lastTime = currentTime;

    const displacement = position - to;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * vel;
    const acceleration = (springForce + dampingForce) / mass;

    vel += acceleration * deltaTime;
    position += vel * deltaTime;

    callback(position);

    if (Math.abs(position - to) < 0.5 && Math.abs(vel) < 0.5) {
      callback(to);
      onComplete?.();
      return;
    }

    animationFrame = requestAnimationFrame(step);
  };

  animationFrame = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(animationFrame);
  };
}
