"use client";

import { motion } from "framer-motion";
import { fadeIn, spring, pressMotionSubtle } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  delay?: number;
  elevated?: boolean;
  glass?: boolean;
  noPad?: boolean;
}

export default function MotionCard({
  children, className, href, onClick, delay = 0, elevated, glass, noPad,
}: Props) {
  const base = cn(
    elevated ? "card-elevated" : glass ? "glass" : "card",
    !noPad && "p-5",
    (href || onClick) && "cursor-pointer",
    className
  );

  const motionProps = {
    variants: fadeIn,
    initial: "hidden",
    animate: "visible",
    transition: { ...spring, delay },
    ...(href || onClick ? pressMotionSubtle : {}),
  };

  if (href) {
    return (
      <motion.a href={href} className={base} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.div
      className={base}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
