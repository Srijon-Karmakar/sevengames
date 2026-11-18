/**
 * Senevon token: a filled, rounded lightning bolt in electric lime (#9EFF00), no background.
 * Drawn as one shape whose corners are rounded by a same-colour stroke, so it stays soft at any size.
 */
export const TOKEN_COLOR = "#9EFF00";

export default function TokenIcon({ size = 16, className = "", title }: { size?: number | string; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`token-icon ${className}`.trim()}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path
        d="M13.4 2.6 5.6 12.4c-.3.4 0 1 .5 1h5.2l-.9 7.3c-.1.6.7.9 1 .4l7.9-9.9c.3-.4 0-1-.5-1h-5.3l1-7.2c.1-.6-.7-.9-1.1-.4Z"
        fill={TOKEN_COLOR}
        stroke={TOKEN_COLOR}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
