const DashboardPlaceholder = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default DashboardPlaceholder;
