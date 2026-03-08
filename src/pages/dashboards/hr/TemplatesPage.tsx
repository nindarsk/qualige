import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { BANKING_TOPICS, TopicCard } from "@/components/course-creation/TopicCards";

const TEMPLATE_META: Record<string, { duration: string; modules: number; difficulty: string; objectives: string[] }> = {
  aml: { duration: "45 min", modules: 5, difficulty: "Intermediate", objectives: ["Understand AML regulations", "Identify suspicious transactions", "Know reporting obligations", "Apply customer due diligence", "Recognize money laundering typologies"] },
  kyc: { duration: "40 min", modules: 5, difficulty: "Intermediate", objectives: ["Master KYC procedures", "Perform customer identification", "Conduct enhanced due diligence", "Implement ongoing monitoring", "Handle high-risk customers"] },
  gdpr: { duration: "35 min", modules: 4, difficulty: "Beginner", objectives: ["Understand GDPR principles", "Know data subject rights", "Implement privacy by design", "Handle data breach notifications"] },
  fraud: { duration: "40 min", modules: 5, difficulty: "Intermediate", objectives: ["Recognize common fraud schemes", "Implement detection techniques", "Strengthen internal controls", "Follow reporting procedures", "Protect customer accounts"] },
  "customer-service": { duration: "30 min", modules: 4, difficulty: "Beginner", objectives: ["Deliver professional service", "Handle customer complaints", "Build lasting relationships", "Communicate effectively"] },
  risk: { duration: "50 min", modules: 6, difficulty: "Advanced", objectives: ["Identify financial risks", "Apply assessment frameworks", "Design mitigation strategies", "Manage operational risks", "Monitor risk indicators", "Report risk findings"] },
  "it-security": { duration: "35 min", modules: 5, difficulty: "Beginner", objectives: ["Practice cybersecurity hygiene", "Recognize phishing attempts", "Manage passwords securely", "Respond to security incidents", "Protect sensitive data"] },
  "hr-policy": { duration: "30 min", modules: 4, difficulty: "Beginner", objectives: ["Understand code of conduct", "Follow workplace ethics", "Prevent discrimination", "Apply disciplinary procedures"] },
  "financial-products": { duration: "45 min", modules: 6, difficulty: "Intermediate", objectives: ["Understand deposit products", "Know loan offerings", "Explain card products", "Present investment options", "Describe insurance services", "Promote digital banking"] },
  operational: { duration: "35 min", modules: 4, difficulty: "Intermediate", objectives: ["Follow daily compliance rules", "Maintain proper documentation", "Apply quality standards", "Handle audit requirements"] },
};

const TemplatesPage = () => {
  const navigate = useNavigate();
  const [previewTopic, setPreviewTopic] = useState<TopicCard | null>(null);

  const handleUseTemplate = (topic: TopicCard) => {
    navigate("/hr/upload", { state: { tab: "ai-course", topicId: topic.id } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Course Templates</h1>
        <p className="text-muted-foreground">
          Start faster with pre-built banking training templates. Customize any template to match your organization's specific needs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BANKING_TOPICS.map((topic) => {
          const meta = TEMPLATE_META[topic.id];
          return (
            <Card key={topic.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{topic.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{topic.name}</h3>
                    <p className="text-sm text-muted-foreground">{topic.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{meta.duration}</Badge>
                  <Badge variant="outline">{meta.modules} modules</Badge>
                  <Badge variant="outline">{meta.difficulty}</Badge>
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewTopic(topic)}>
                    Preview
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => handleUseTemplate(topic)}>
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewTopic} onOpenChange={(open) => !open && setPreviewTopic(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{previewTopic?.icon}</span>
              {previewTopic?.name}
            </DialogTitle>
          </DialogHeader>
          {previewTopic && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{previewTopic.description}</p>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Learning Objectives</h4>
                <ul className="space-y-1">
                  {TEMPLATE_META[previewTopic.id].objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-accent">✓</span> {obj}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{TEMPLATE_META[previewTopic.id].duration}</Badge>
                <Badge variant="outline">{TEMPLATE_META[previewTopic.id].modules} modules</Badge>
                <Badge variant="outline">{TEMPLATE_META[previewTopic.id].difficulty}</Badge>
              </div>
              <Button className="w-full" onClick={() => { setPreviewTopic(null); handleUseTemplate(previewTopic); }}>
                Use This Template
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesPage;
