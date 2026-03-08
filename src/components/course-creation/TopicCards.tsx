import { cn } from "@/lib/utils";

export interface TopicCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultAudience: string;
  defaultPrompt: string;
}

export const BANKING_TOPICS: TopicCard[] = [
  { id: "aml", name: "AML & Anti-Money Laundering", icon: "🏦", description: "Detecting and preventing money laundering in banking operations", defaultAudience: "All Staff", defaultPrompt: "Create a comprehensive AML training course covering suspicious transaction identification, customer due diligence, reporting obligations, and regulatory requirements." },
  { id: "kyc", name: "KYC — Know Your Customer", icon: "🔍", description: "Customer identification, verification and due diligence procedures", defaultAudience: "All Staff", defaultPrompt: "Create a KYC training course covering customer identification, verification procedures, enhanced due diligence, and ongoing monitoring requirements." },
  { id: "gdpr", name: "GDPR & Data Protection", icon: "🔒", description: "Personal data handling, privacy rights and compliance requirements", defaultAudience: "All Staff", defaultPrompt: "Create a data protection training course covering GDPR principles, data subject rights, lawful processing, breach notification, and privacy by design." },
  { id: "fraud", name: "Fraud Prevention", icon: "⚠️", description: "Identifying and preventing fraudulent transactions and activities", defaultAudience: "All Staff", defaultPrompt: "Create a fraud prevention course covering common fraud schemes, detection techniques, internal controls, and reporting procedures." },
  { id: "customer-service", name: "Customer Service Standards", icon: "⭐", description: "Professional banking customer service and communication skills", defaultAudience: "All Staff", defaultPrompt: "Create a customer service training course covering professional communication, complaint handling, service excellence, and customer relationship management." },
  { id: "risk", name: "Risk Management", icon: "📊", description: "Identifying, assessing and mitigating financial and operational risks", defaultAudience: "All Staff", defaultPrompt: "Create a risk management course covering risk identification, assessment frameworks, mitigation strategies, and operational risk controls." },
  { id: "it-security", name: "IT Security & Cybersecurity", icon: "💻", description: "Digital security practices, phishing prevention and data safety", defaultAudience: "All Staff", defaultPrompt: "Create an IT security course covering cybersecurity best practices, phishing prevention, password management, and incident response." },
  { id: "hr-policy", name: "HR Policies & Code of Conduct", icon: "📋", description: "Workplace policies, ethics and professional conduct standards", defaultAudience: "All Staff", defaultPrompt: "Create an HR policy course covering code of conduct, workplace ethics, anti-discrimination, harassment prevention, and disciplinary procedures." },
  { id: "financial-products", name: "Financial Products Knowledge", icon: "💰", description: "Understanding banking products, services and their features", defaultAudience: "All Staff", defaultPrompt: "Create a financial products course covering deposits, loans, cards, investment products, insurance, and digital banking services." },
  { id: "operational", name: "Operational Compliance", icon: "✅", description: "Day-to-day regulatory compliance and operational procedures", defaultAudience: "All Staff", defaultPrompt: "Create an operational compliance course covering daily regulatory requirements, internal procedures, documentation standards, and quality controls." },
];

interface TopicCardsProps {
  selectedTopic: string | null;
  onSelectTopic: (topic: TopicCard) => void;
}

const TopicCards = ({ selectedTopic, onSelectTopic }: TopicCardsProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {BANKING_TOPICS.map((topic) => (
        <button
          key={topic.id}
          type="button"
          onClick={() => onSelectTopic(topic)}
          className={cn(
            "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md",
            selectedTopic === topic.id
              ? "border-accent bg-accent/5 shadow-md"
              : "border-border hover:border-primary/30"
          )}
        >
          <span className="text-2xl">{topic.icon}</span>
          <span className="text-sm font-semibold text-foreground leading-tight">{topic.name}</span>
          <span className="text-xs text-muted-foreground line-clamp-2">{topic.description}</span>
        </button>
      ))}
    </div>
  );
};

export default TopicCards;
