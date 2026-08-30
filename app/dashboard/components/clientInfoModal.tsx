"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { 
  Building, 
  Target, 
  User, 
  MapPin, 
  Calendar,
  BarChart3,
  Leaf,
  Zap,
  Recycle,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

interface ClientInfoModalProps {
  onSave: (data: any) => void;
}

interface SiteFormData {
  name: string;
  location: string;
  projectType: string;
  size: string;
  startDate: string;
  endDate: string;
  budget: string;
}

interface ProfileFormData {
  name: string;
  email: string;
  company: string;
  role: string;
  sustainabilityGoals: string;
  reductionTarget: number;
  focusAreas: string[];
}

export default function ClientInfoModal({ onSave }: ClientInfoModalProps) {
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Onboarding is mandatory until setup completes; Escape must not submit or dismiss it.
        event.preventDefault();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, []);
  
  // Profile Data
  const [profile, setProfile] = useState<ProfileFormData>({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    company: "",
    role: "",
    sustainabilityGoals: "",
    reductionTarget: 25,
    focusAreas: []
  });

  // Site Data
  const [sites, setSites] = useState<SiteFormData[]>([
    {
      name: "",
      location: "",
      projectType: "residential",
      size: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      budget: ""
    }
  ]);

  const projectTypes = [
    { value: "residential", label: "Residential Building", icon: "🏠" },
    { value: "commercial", label: "Commercial Building", icon: "🏢" },
    { value: "industrial", label: "Industrial Facility", icon: "🏭" },
    { value: "infrastructure", label: "Infrastructure Project", icon: "🌉" },
    { value: "renovation", label: "Renovation/Retrofit", icon: "🔨" },
    { value: "other", label: "Other", icon: "📦" }
  ];

  const focusAreas = [
    { id: "energy", label: "Energy Efficiency", icon: Zap },
    { id: "materials", label: "Sustainable Materials", icon: Leaf },
    { id: "waste", label: "Waste Management", icon: Recycle },
    { id: "water", label: "Water Conservation", icon: "💧" },
    { id: "transport", label: "Transport & Logistics", icon: "🚚" },
    { id: "biodiversity", label: "Biodiversity", icon: "🌿" }
  ];

  const updateProfile = (field: keyof ProfileFormData, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const updateSite = (index: number, field: keyof SiteFormData, value: string) => {
    setSites(prev => prev.map((site, i) => 
      i === index ? { ...site, [field]: value } : site
    ));
  };

  const addNewSite = () => {
    setSites(prev => [...prev, {
      name: "",
      location: "",
      projectType: "residential",
      size: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      budget: ""
    }]);
  };

  const removeSite = (index: number) => {
    if (sites.length > 1) {
      setSites(prev => prev.filter((_, i) => i !== index));
    }
  };

  const toggleFocusArea = (areaId: string) => {
    setProfile(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(areaId)
        ? prev.focusAreas.filter(id => id !== areaId)
        : [...prev.focusAreas, areaId]
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Save Profile
      const profilePayload = {
        name: profile.name,
        email: profile.email,
        company: profile.company,
        role: profile.role,
        sustainabilityGoals: profile.sustainabilityGoals,
        reductionTarget: profile.reductionTarget,
        focusAreas: profile.focusAreas,
        setupCompleted: true
      };
  
      console.log("📝 Saving profile...", profilePayload);
  
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
  
      if (!profileRes.ok) {
        const errorData = await profileRes.json();
        console.error("❌ Profile save failed:", errorData);
        throw new Error(errorData.error || "Failed to save profile");
      }
      
      const savedProfile = await profileRes.json();
      console.log("✅ Profile saved:", savedProfile);
  
      // 2. Save Sites
      const sitesPromises = sites.map(async (site, index) => {
        const sitePayload = {
          ...site,
          userId: session?.user?.email,
        };
        
        console.log(`🏗️ Saving site ${index + 1}...`, sitePayload);
  
        const siteRes = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sitePayload),
        });
        
        if (!siteRes.ok) {
          const errorData = await siteRes.json();
          console.error(`❌ Site ${index + 1} save failed:`, errorData);
          throw new Error(errorData.error || `Failed to save site ${index + 1}`);
        }
        
        const savedSite = await siteRes.json();
        console.log(`✅ Site ${index + 1} saved:`, savedSite);
        return savedSite;
      });
  
      const savedSites = await Promise.all(sitesPromises);
      console.log("✅ All sites saved:", savedSites);
  
      // 3. Create Initial Carbon Data for each site
      const carbonPromises = savedSites.map(async (site, index) => {
        const carbonPayload = {
          siteId: site._id || site.id,
          baselineEmissions: 0,
          currentEmissions: 0,
          reductionTarget: profile.reductionTarget,
          activities: []
        };
  
        console.log(`🌱 Creating carbon data for site ${index + 1}...`, carbonPayload);
  
        const carbonRes = await fetch("/api/carbon-data/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(carbonPayload),
        });
        
        if (!carbonRes.ok) {
          const errorData = await carbonRes.json();
          console.error(`❌ Carbon data for site ${index + 1} failed:`, errorData);
          throw new Error("Failed to create carbon data");
        }
        
        const carbonData = await carbonRes.json();
        console.log(`✅ Carbon data for site ${index + 1} created:`, carbonData);
        return carbonData;
      });
  
      await Promise.all(carbonPromises);
      console.log("🎉 Setup completed successfully!");
  
      // 4. Call onSave with all the data
      onSave({
        profile: savedProfile,
        sites: savedSites,
        setupCompleted: true
      });
  
    } catch (err) {
      console.error("❌ Error during setup:", err);
      alert("Failed to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">Profile Setup</h3>
        <p className="text-gray-600">Tell us about yourself and your sustainability goals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => updateProfile('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => updateProfile('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company/Organization
          </label>
          <input
            type="text"
            value={profile.company}
            onChange={(e) => updateProfile('company', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Role
          </label>
          <input
            type="text"
            value={profile.role}
            onChange={(e) => updateProfile('role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Project Manager, Sustainability Officer"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Carbon Reduction Target
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={profile.reductionTarget}
            onChange={(e) => updateProfile('reductionTarget', parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-lg font-bold text-blue-600 min-w-12">
            {profile.reductionTarget}%
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Target carbon emissions reduction compared to baseline
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Focus Areas (Select up to 3)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {focusAreas.map((area) => {
            const isSelected = profile.focusAreas.includes(area.id);

            return (
              <button
                key={area.id}
                type="button"
                onClick={() => toggleFocusArea(area.id)}
                disabled={!isSelected && profile.focusAreas.length >= 3}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                } ${!isSelected && profile.focusAreas.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {typeof area.icon === "string" ? (
                    <span className="text-lg">{area.icon}</span>
                  ) : (
                    <area.icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{area.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sustainability Goals & Objectives
        </label>
        <textarea
          value={profile.sustainabilityGoals}
          onChange={(e) => updateProfile('sustainabilityGoals', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Describe your key sustainability objectives, certifications you're targeting (LEED, BREEAM, etc.), and any specific environmental commitments..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">Project Sites</h3>
        <p className="text-gray-600">Add your construction sites or projects to track</p>
      </div>

      {sites.map((site, index) => (
        <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-800">
              Site {index + 1} {site.name && `- ${site.name}`}
            </h4>
            {sites.length > 1 && (
              <button
                type="button"
                onClick={() => removeSite(index)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site Name *
              </label>
              <input
                type="text"
                value={site.name}
                onChange={(e) => updateSite(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Riverside Tower, Main Office Renovation"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                type="text"
                value={site.location}
                onChange={(e) => updateSite(index, 'location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Nairobi, Kenya"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Type *
              </label>
              <select
                value={site.projectType}
                onChange={(e) => updateSite(index, 'projectType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {projectTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Size
              </label>
              <input
                type="text"
                value={site.size}
                onChange={(e) => updateSite(index, 'size', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 5000 sqm, 20 floors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={site.startDate}
                onChange={(e) => updateSite(index, 'startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Completion
              </label>
              <input
                type="date"
                value={site.endDate}
                onChange={(e) => updateSite(index, 'endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Budget (Optional)
            </label>
            <input
              type="text"
              value={site.budget}
              onChange={(e) => updateSite(index, 'budget', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., KES 50,000,000"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addNewSite}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        + Add Another Site
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800">Ready to Go! 🎉</h3>
      
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 text-left">
        <h4 className="font-semibold text-gray-800 mb-4">Setup Summary</h4>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Profile:</span>
            <span className="font-medium">{profile.name}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Reduction Target:</span>
            <span className="font-medium text-blue-600">{profile.reductionTarget}%</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Focus Areas:</span>
            <span className="font-medium text-right">
              {profile.focusAreas.map(id => 
                focusAreas.find(a => a.id === id)?.label
              ).join(', ')}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Sites Added:</span>
            <span className="font-medium">{sites.length} site(s)</span>
          </div>
          
          <div className="pt-3 border-t border-gray-200">
            <div className="text-gray-600 mb-2">Sites:</div>
            {sites.map((site, index) => (
              <div key={index} className="text-sm text-gray-700 mb-1">
                • {site.name || `Site ${index + 1}`} - {site.location}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-gray-600">
        Your sustainability tracking dashboard is ready! You can always update these settings later.
      </p>
    </div>
  );

  const isStep1Valid = profile.name && profile.email;
  const isStep2Valid = sites.every(site => site.name && site.location);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/50 z-50 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-dialog-title"
        aria-describedby="onboarding-dialog-description"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h2 id="onboarding-dialog-title" className="text-2xl font-bold mb-2">Welcome to JengaSafi! 🌱</h2>
          <p id="onboarding-dialog-description" className="opacity-90">Let's set up your sustainability tracking profile</p>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mt-6">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= step ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-white' : 'bg-white/20'
                  }`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-between text-xs mt-2" aria-live="polite">
            <span className={currentStep >= 1 ? 'font-semibold' : 'opacity-70'}>Profile</span>
            <span className={currentStep >= 2 ? 'font-semibold' : 'opacity-70'}>Sites</span>
            <span className={currentStep >= 3 ? 'font-semibold' : 'opacity-70'}>Complete</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto" aria-label={`Onboarding step ${currentStep} of 3`}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={currentStep === 1}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={
                  (currentStep === 1 && !isStep1Valid) ||
                  (currentStep === 2 && !isStep2Valid)
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting Up...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}