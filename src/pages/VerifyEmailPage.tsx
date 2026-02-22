import { Link } from "react-router-dom";
import { BookOpen, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerifyEmailPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-accent/10 p-4">
            <Mail className="h-10 w-10 text-accent" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Check Your Email</h1>
        <p className="mb-8 text-muted-foreground">
          We've sent a verification link to your email address. Please click the link to verify your account and get started.
        </p>
        <Button variant="outline" asChild>
          <Link to="/login">Back to Sign In</Link>
        </Button>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
