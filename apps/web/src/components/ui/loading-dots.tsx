/**
 * Three dots bouncing in sequence, for pending states on buttons.
 *
 * The dots use `bg-current`, so they inherit the colour of whatever button they sit in and stay
 * visible on dark, light and outline variants alike.
 */
const LoadingDots = () => {
  return (
    <span className="loading-dots" role="status" aria-label="Working">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
};

export { LoadingDots };
export default LoadingDots;
