import React from 'react';

export default function PageHeader({ title, description, icon: Icon, action }) {
  return (
    <div className="page-header-card">
      <div className="page-header-left">
        {Icon && (
          <div className="page-header-icon-wrap">
            <Icon size={24} />
          </div>
        )}
        <div>
          <h1 className="page-header-title">{title}</h1>
          {description && <p className="page-header-desc">{description}</p>}
        </div>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
