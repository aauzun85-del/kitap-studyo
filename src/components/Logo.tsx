import { BookIcon } from "./PhosphorIcons";

export default function Logo({ className = "" }: { className?: string }) {
  return <BookIcon className={`text-accent ${className}`} />;
}
