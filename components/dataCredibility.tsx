// components/data-source-credibility.tsx
"use client";

interface DataSource {
  lastUpdated: string;
  credibility: string;
}

interface DataSourceCredibilityProps {
  dataSources: {
    kenyaPower: DataSource;
    unfccc: DataSource;
    localData: DataSource;
  };
}

export function DataSourceCredibility({ dataSources }: DataSourceCredibilityProps) {
  return (
    <div className="bg-muted/50 p-4 rounded-lg border">
      <h4 className="font-semibold text-sm mb-2">Data provenance</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Kenya Power Grid: {dataSources.kenyaPower.credibility}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>United Nations Framework Convention on Climate Change: {dataSources.unfccc.credibility}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Local Data: {dataSources.localData.credibility}</span>
        </div>
      </div>
    </div>
  );
}