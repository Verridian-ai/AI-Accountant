export function springAnimation(
  from: number,
  to: number,
  velocity: number,
  callback: (value: number) => void,
  onComplete?: () => void,
): () => void {
  const stiffness = 300;
  const damping = 30;
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

    // Check if animation is complete
    if (Math.abs(position - to) < 0.5 && Math.abs(vel) < 0.1) {
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
