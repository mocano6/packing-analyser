"use client";

import React from "react";
import styles from "./Input.module.css";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className, ...rest }, ref) => {
    const classes = [styles.input, invalid ? styles.invalid : "", className || ""]
      .filter(Boolean)
      .join(" ");
    return <input ref={ref} className={classes} {...rest} />;
  },
);

Input.displayName = "Input";

export default Input;
