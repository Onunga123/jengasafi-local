import { useState } from "react";
import axios from "axios";
import ContactCard from "@/components/cards/contact";
import Heading from "@/components/heading/heading";
import Card from "@/components/ui/card";
import { Phone, Mail } from "lucide-react"; // <-- clean TS-safe icons
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponseMessage("");

    try {
      const response = await axios.post("/api/contact", formData);

      if (response.status === 200) {
        setResponseMessage("Message sent successfully!");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setResponseMessage("Failed to send message. Please try again.");
      }
    } catch (error) {
      setResponseMessage("An error occurred. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative h-screen overflow-hidden bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Heading */}
      <Heading number="04" title_1="Contact" title_2="Us" />

      {/* Content */}
      <Card className="relative w-full max-w-6xl mx-auto bg-white/80 backdrop-blur-md border border-green-100 shadow-lg rounded-2xl p-10">
        {/* Decorative Gradient Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-lime-500 opacity-70 rounded-t-2xl"></div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Contact Options */}
          <div className="flex flex-col gap-6">
            <ContactCard
              title="Call us directly"
              icon={<Phone className="text-3xl text-green-600" />}
              text="+254-791-019-668"
              btnText="Call Us"
              className="hover:shadow-xl hover:border-green-300 transition-all"
            />
            <ContactCard
              title="Chat with us"
              icon={<Mail className="text-3xl text-gray-800" />}
              text="jengasafi@gmail.com"
              btnText="Email Us"
              className="hover:shadow-xl hover:border-green-300 transition-all"
            />
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm border border-green-100 rounded-xl p-6 shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="focus:ring-2 focus:ring-green-400"
                />
                <Input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  icon={<Mail className="text-gray-500" />}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="focus:ring-2 focus:ring-green-400"
                />
              </div>

              <Input
                type="text"
                name="subject"
                placeholder="Subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="focus:ring-2 focus:ring-green-400"
              />

              <textarea
                name="message"
                placeholder="Your message..."
                value={formData.message}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 resize-none focus:ring-2 focus:ring-green-400"
                rows={5}
                required
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-40 py-3 text-lg bg-gradient-to-r from-green-500 via-emerald-400 to-lime-500 text-white shadow-md hover:opacity-90 transition-all"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>

              {responseMessage && (
                <p
                  className={`mt-4 text-center ${
                    responseMessage.includes("Failed") ||
                    responseMessage.includes("error")
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {responseMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      </Card>
    </section>
  );
}
