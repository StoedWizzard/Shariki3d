export const SectionCard: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="section-card">
    {title && <div className="section-title">{title}</div>}
    {children}
  </div>
);
