"use client";

import React from "react";
import styles from "./Select.module.css";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => {
    const classes = [styles.select, className || ""].filter(Boolean).join(" ");
    return (
      <select ref={ref} className={classes} {...rest}>
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";

export default Select;
