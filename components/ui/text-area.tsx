import { FC, ReactNode, TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: ReactNode;
  placeholder?: string;
}
const TextArea: FC<TextAreaProps> = ({ icon, className, ...props }) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
        {icon}
      </div>
      <textarea {...props} className={`bg-primary-background text-primary-foreground w-full rounded-lg text-sm ps-10 p-2.5 pt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${className || ""}`} />
    </div>
  );
};

export default TextArea;
