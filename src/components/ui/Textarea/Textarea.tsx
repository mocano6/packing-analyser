"use client";

import React from "react";
import styles from "./Textarea.module.css";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => {
    const classes = [styles.textarea, className || ""]
      .filter(Boolean)
      .join(" ");
    return <textarea ref={ref} className={classes} {...rest} />;
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
