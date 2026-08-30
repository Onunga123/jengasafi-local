import { FC, InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  icon?: ReactNode;
  placeholder?: string;
  type: "email" | "text" | "password";
}
const Input: FC<InputProps> = ({ icon, className, ...props }) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
        {icon}
      </div>
      <input {...props} className={`bg-primary-background text-primary-foreground w-full rounded-lg text-sm ps-10 px-2.5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${className || ""}`} />
    </div>
  );
};

export default Input;
