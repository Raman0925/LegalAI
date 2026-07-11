'use client';

import { ContractAnnotation } from '@/types/contracts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const RISK_CLASSES: Record<ContractAnnotation['riskLevel'], string> = {
  critical: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100/50',
  high:     'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100/50',
  medium:   'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100/50',
  low:      'bg-green-50 border-green-200 text-green-800 hover:bg-green-100/50',
};

const RISK_BADGE_VARIANT: Record<ContractAnnotation['riskLevel'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  critical: 'destructive',
  high:     'outline',
  medium:   'outline',
  low:      'secondary',
};

const RISK_BADGE_CLASSES: Record<ContractAnnotation['riskLevel'], string> = {
  critical: '',
  high:     'text-orange-700 border-orange-300 bg-orange-50',
  medium:   'text-yellow-700 border-yellow-300 bg-yellow-50',
  low:      'text-green-700 border-green-300 bg-green-50',
};

interface AnnotationSidebarProps {
  annotations: ContractAnnotation[];
  selectedId: string | null;
  onSelect: (annotation: ContractAnnotation) => void;
  loading?: boolean;
  progress?: number;
}

export function AnnotationSidebar({
  annotations,
  selectedId,
  onSelect,
  loading,
  progress,
}: AnnotationSidebarProps) {
  const criticalCount = annotations.filter(a => a.riskLevel === 'critical').length;
  const highCount = annotations.filter(a => a.riskLevel === 'high').length;

  return (
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-base">Contract Review Annotations</h3>
        {annotations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="font-semibold animate-pulse">{criticalCount} Critical</Badge>
            )}
            {highCount > 0 && (
              <Badge variant="outline" className="font-semibold text-orange-700 border-orange-300 bg-orange-50">
                {highCount} High
              </Badge>
            )}
            <Badge variant="secondary" className="font-semibold">{annotations.length} total</Badge>
          </div>
        )}
      </div>

      {/* Progress bar during analysis */}
      {loading && progress !== undefined && (
        <div className="px-4 py-3 border-b bg-blue-50 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
            <span className="font-medium">Analyzing contract...</span>
            <span className="font-mono font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-12">
            <p className="font-medium text-sm">No clauses annotated yet.</p>
            {loading ? (
              <p className="text-xs text-gray-400 mt-1">Please wait while the AI analyzes the pages...</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">AI analysis has not run yet or failed.</p>
            )}
          </div>
        ) : (
          annotations.map((annotation) => {
            const isSelected = selectedId === annotation.id;
            return (
              <div
                key={annotation.id}
                onClick={() => onSelect(annotation)}
                className={cn(
                  "p-3 rounded-lg border text-left cursor-pointer transition-all duration-200",
                  RISK_CLASSES[annotation.riskLevel],
                  isSelected
                    ? "ring-2 ring-blue-500 border-transparent shadow-sm"
                    : "border-gray-200"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
                    PAGE {annotation.pageNumber} {annotation.citationRef && `• ${annotation.citationRef}`}
                  </span>
                  <Badge
                    variant={RISK_BADGE_VARIANT[annotation.riskLevel]}
                    className={cn("text-[10px] py-0 px-1.5 uppercase font-bold", RISK_BADGE_CLASSES[annotation.riskLevel])}
                  >
                    {annotation.riskLevel}
                  </Badge>
                </div>

                {/* Clause Type */}
                <h4 className="font-bold text-gray-900 text-sm mb-1 capitalize">
                  {annotation.clauseType.replace(/_/g, ' ')}
                </h4>

                {/* Explanation */}
                <p className="text-xs text-gray-700 leading-relaxed mb-2 line-clamp-3">
                  {annotation.explanation}
                </p>

                {/* Quoted Text (Short preview) */}
                <div className="bg-white/70 border border-gray-100 rounded p-1.5 mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 block mb-0.5 uppercase tracking-wide">
                    Exact Clause Text
                  </span>
                  <p className="text-[10px] text-gray-600 font-mono italic line-clamp-2">
                    &ldquo;{annotation.clauseText}&rdquo;
                  </p>
                </div>

                {/* Suggestion if High/Critical */}
                {annotation.suggestion && (annotation.riskLevel === 'high' || annotation.riskLevel === 'critical') && (
                  <div className="mt-1.5 border-t border-dashed border-gray-300 pt-1.5 text-[10px] text-gray-800">
                    <span className="font-semibold block text-red-700 uppercase tracking-wide mb-0.5">AI Suggestion</span>
                    <p className="leading-relaxed italic">{annotation.suggestion}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
