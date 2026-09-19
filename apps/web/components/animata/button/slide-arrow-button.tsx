import { ArrowRight } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface SlideArrowButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
  primaryColor?: string;
}
 
export default function SlideArrowButton({
  text = "Get Started",
  primaryColor = "#2b00ff", // Brand blue
  className = "",
  ...props
}: SlideArrowButtonProps) {
  return (
    <div
      className={cn(`group/slide relative rounded-full border border-white/20 bg-white/20 backdrop-blur-md p-2 text-xl font-semibold shadow-sm cursor-pointer`, className)}
      {...props}
    >
      <div
        className="absolute left-0 top-0 flex h-full w-12 items-center justify-end rounded-full transition-all duration-300 ease-out group-hover/slide:w-full"
        style={{ backgroundColor: primaryColor }}
      >
        <span className="mr-3 text-white transition-all duration-300 ease-out">
          <ArrowRight size={20} />
        </span>
      </div>
      <span className="relative left-4 z-10 whitespace-nowrap px-8 font-semibold text-slate-800 transition-all duration-300 ease-out group-hover/slide:-left-3 group-hover/slide:text-white">
        {text}
      </span>
    </div>
  );
}
