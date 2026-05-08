import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ComponentType, ReactElement } from "react";
import type { LucideProps } from "lucide-react";

import "./Button.css";

// ---------------------------------------------------------------------------
// Button primitive.
//
// A thin wrapper over <button> that applies one of the tokenized visual
// variants and an optional leading icon. Consumers pass standard
// ButtonHTMLAttributes; the primitive only owns styling, the aria-busy
// wiring for the loading state, and the `type="button"` default (so the
// component never accidentally behaves like a form submit when rendered
// outside a <form>).
//
// Why the optional-undefined typing: with
// `exactOptionalPropertyTypes: true`, passing `variant={maybeUndefined}`
// from a caller that has an unresolved variant would fail to compile
// against a plain `variant?: ButtonVariant`. Widening the optional
// props to `T | undefined` lets callers pass explicit undefined and
// still resolve to the documented default.
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/** Any component that renders a lucide-react glyph (or a compatible icon). */
export type ButtonIconComponent = ComponentType<LucideProps>;

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize | undefined;
  readonly isLoading?: boolean | undefined;
  readonly icon?: ButtonIconComponent | undefined;
  /** `"button" | "submit" | "reset"`. Default `"button"`. */
  readonly type?: "button" | "submit" | "reset" | undefined;
}

/**
 * Build the class list for a given variant/size pair. Extracted so the
 * mapping stays colocated with the component and is easy to audit.
 */
function buildClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  className: string | undefined,
): string {
  const variantClass = `ui-button--${variant}`;
  const sizeClass = `ui-button--${size}`;
  return ["ui-button", variantClass, sizeClass, className]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant,
      size = "md",
      isLoading = false,
      icon: Icon,
      disabled,
      type = "button",
      className,
      children,
      ...rest
    },
    ref,
  ): ReactElement {
    const busy = isLoading === true;
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={disabled === true || busy}
        aria-busy={busy}
        className={buildClassName(variant, size, className)}
      >
        {Icon !== undefined ? (
          <span aria-hidden="true" className="ui-button__icon">
            <Icon size={16} />
          </span>
        ) : null}
        {children}
      </button>
    );
  },
);

export default Button;
