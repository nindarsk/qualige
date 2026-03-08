import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export type QuizOptionState =
  | "default"
  | "selected"
  | "correct"
  | "incorrect"
  | "correct-unselected";

interface QuizOptionCardProps {
  index: number;
  label: string;
  state?: QuizOptionState;
  onClick?: () => void;
  disabled?: boolean;
  showCheck?: boolean;
}

const stateStyles: Record<QuizOptionState, string> = {
  default:
    "border-[#E5E7EB] bg-white hover:bg-[#EFF6FF] hover:border-[#1B3A6B] cursor-pointer",
  selected:
    "border-[#1B3A6B] bg-[#EFF6FF] text-[#1B3A6B] cursor-pointer",
  correct:
    "border-[#059669] bg-[#F0FDF4]",
  incorrect:
    "border-[#DC2626] bg-[#FEF2F2]",
  "correct-unselected":
    "border-[#059669] bg-[#F0FDF4] opacity-80",
};

const badgeStyles: Record<QuizOptionState, string> = {
  default: "bg-[#F3F4F6] text-gray-500",
  selected: "bg-[#1B3A6B] text-white",
  correct: "bg-[#059669] text-white",
  incorrect: "bg-[#DC2626] text-white",
  "correct-unselected": "bg-[#059669] text-white",
};

const QuizOptionCard = ({
  index,
  label,
  state = "default",
  onClick,
  disabled = false,
  showCheck = false,
}: QuizOptionCardProps) => {
  const letter = String.fromCharCode(65 + index);

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3.5 rounded-xl border-2 px-5 py-4 text-left transition-all duration-200 ease-in-out",
        "min-h-[56px] h-auto",
        stateStyles[state],
        disabled && "cursor-default"
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200",
          badgeStyles[state]
        )}
      >
        {letter}
      </span>

      {/* Answer text */}
      <span
        className={cn(
          "flex-1 text-sm font-medium leading-relaxed break-words whitespace-normal",
          state === "selected" && "text-[#1B3A6B]",
          state === "correct" && "text-[#059669]",
          state === "incorrect" && "text-[#DC2626]",
          state === "default" && "text-foreground",
          state === "correct-unselected" && "text-[#059669]"
        )}
      >
        {label}
      </span>

      {/* Check icon for selected state */}
      {showCheck && state === "selected" && (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1B3A6B]" />
      )}
    </button>
  );
};

export default QuizOptionCard;
