import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
	Frame,
	FramePanel,
	FrameHeader,
	FrameTitle,
	FrameDescription,
} from "#/components/reui/frame.tsx";
import { Badge } from "#/components/reui/badge.tsx";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	CloudUploadIcon,
	AiScanIcon,
	Search01Icon,
	Layers01Icon,
	GitMergeIcon,
	TaskDone01Icon,
	Database01Icon,
	SearchList01Icon,
	CheckListIcon,
	PackageIcon,
} from "@hugeicons/core-free-icons";

const iconMap: Record<string, any> = {
	upload: CloudUploadIcon,
	barcode: AiScanIcon,
	ocr: AiScanIcon,
	vision: PackageIcon,
	grouping: Layers01Icon,
	aggregation: GitMergeIcon,
	normalization: TaskDone01Icon,
	database: Database01Icon,
	deduplication: SearchList01Icon,
};

import { Cloudflare } from "#/components/ui/svgs/cloudflare.tsx";
import { Sqlite } from "#/components/ui/svgs/sqlite.tsx";
import { QwenLight } from "#/components/ui/svgs/qwenLight.tsx";

export type CustomNodeData = {
	title: string;
	description: string;
	iconType: keyof typeof iconMap;
	status?: "pending" | "active" | "completed" | "failed";
	badge?: string;
	processedCount?: number;
	totalCount?: number;
};

export const CustomNode = memo(({ data, isConnectable }: NodeProps) => {
	const nodeData = data as CustomNodeData;

	// Status styling
	let ringClass = "border-transparent";
	if (nodeData.status === "active")
		ringClass =
			"ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse";
	if (nodeData.status === "completed")
		ringClass = "ring-2 ring-success ring-offset-1 ring-offset-background";
	if (nodeData.status === "failed")
		ringClass = "ring-2 ring-destructive ring-offset-1 ring-offset-background";

	// Custom Icon Rendering
	let IconContent = null;
	if (nodeData.iconType === "upload") {
		IconContent = <Cloudflare className="w-5 h-5" />;
	} else if (nodeData.iconType === "database") {
		IconContent = <Cloudflare className="w-5 h-5" />;
	} else if (nodeData.iconType === "vision") {
		IconContent = <QwenLight className="w-5 h-5 text-foreground" />;
	} else if (nodeData.iconType === "ocr") {
		IconContent = (
			<div className="flex items-center gap-1.5">
				<QwenLight className="w-4 h-4 text-foreground" />
				<HugeiconsIcon
					icon={Search01Icon}
					strokeWidth={2.5}
					className="size-4 text-foreground"
				/>
			</div>
		);
	} else {
		const Icon = iconMap[nodeData.iconType as string] || TaskDone01Icon;
		IconContent = (
			<HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4" />
		);
	}

	// Render a custom 3D cylindrical database container for the database write node
	if (nodeData.iconType === "database") {
		return (
			<div
				className={`relative w-[220px] h-[170px] ${ringClass} transition-all duration-300`}
			>
				<Handle
					type="target"
					position={Position.Left}
					isConnectable={isConnectable}
					className="w-3 h-3 border-2 border-background bg-muted-foreground"
				/>

				{/* Cylinder Top Cap */}
				<div className="absolute top-0 left-0 w-full h-7 rounded-[50%/14px] bg-card border border-border shadow-sm flex items-center justify-between px-6 z-20 bg-gradient-to-r from-card via-muted/40 to-muted/20">
					<Cloudflare className="w-3.5 h-3.5 text-primary" />
					<span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
						SQLite / D1
					</span>
				</div>

				{/* Cylinder Body */}
				<div className="absolute top-[14px] left-0 w-full h-[156px] rounded-b-[50%/24px] border-b border-l border-r border-border bg-card shadow-lg bg-gradient-to-r from-card via-card/95 to-card/90 flex flex-col justify-between overflow-hidden">
					{/* Platter Lines for 3D Database Look */}
					<div className="absolute top-[35px] left-0 w-full h-[1px] bg-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" />
					<div className="absolute top-[80px] left-0 w-full h-[1px] bg-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" />
					<div className="absolute top-[125px] left-0 w-full h-[1px] bg-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" />

					{/* Content overlay */}
					<div className="flex-1 flex flex-col justify-around px-4 pt-4 pb-3 text-center relative z-10">
						{/* Title Section */}
						<div className="flex items-center justify-center gap-1.5 mt-2">
							<HugeiconsIcon
								icon={Database01Icon}
								strokeWidth={2.5}
								className="size-4 text-primary"
							/>
							<span className="text-[13px] font-bold text-foreground">
								{nodeData.title}
							</span>
						</div>

						{/* Description Section */}
						<div className="text-[10px] text-muted-foreground leading-snug px-1">
							{nodeData.description}
						</div>

						{/* Platter 3 bottom status info */}
						<div className="text-[9px] font-mono text-muted-foreground/80 pb-1 flex items-center justify-center gap-1">
							<span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
							D1 edge storage active
						</div>
					</div>
				</div>

				<Handle
					type="source"
					position={Position.Right}
					isConnectable={isConnectable}
					className="w-3 h-3 border-2 border-background bg-muted-foreground"
				/>
			</div>
		);
	}

	return (
		<div
			className={`w-[280px] ${ringClass} rounded-(--frame-radius) transition-all duration-300`}
		>
			<Handle
				type="target"
				position={Position.Left}
				isConnectable={isConnectable}
				className="w-3 h-3 border-2 border-background bg-muted-foreground"
			/>

			<Frame spacing="sm" className="shadow-lg bg-card">
				<FramePanel>
					<FrameHeader className="flex flex-row items-start justify-between pb-2">
						<div className="flex items-center gap-2">
							<div className="p-1.5 flex items-center justify-center rounded-md bg-primary/10 text-primary min-w-7 min-h-7">
								{IconContent}
							</div>
							<FrameTitle className="text-[13px]">{nodeData.title}</FrameTitle>
						</div>
						<div className="flex items-center gap-1.5">
							{nodeData.processedCount !== undefined &&
								nodeData.totalCount !== undefined && (
									<span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
										{nodeData.processedCount} / {nodeData.totalCount}
									</span>
								)}
							{nodeData.badge && (
								<Badge
									variant="outline"
									className="text-[10px] uppercase tracking-wider h-5 px-1.5"
								>
									{nodeData.badge}
								</Badge>
							)}
						</div>
					</FrameHeader>
					<div className="px-3 pb-3">
						<FrameDescription className="text-xs">
							{nodeData.description}
						</FrameDescription>
					</div>
				</FramePanel>
			</Frame>

			<Handle
				type="source"
				position={Position.Right}
				isConnectable={isConnectable}
				className="w-3 h-3 border-2 border-background bg-muted-foreground"
			/>
		</div>
	);
});
