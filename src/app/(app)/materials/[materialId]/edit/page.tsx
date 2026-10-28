import type { Metadata } from "next";

import { MaterialForm } from "@/components/materials/material-form";

export const metadata: Metadata = {
  title: "Edit material",
  description: "Update purchasing and stock details for a production material.",
};

export default async function EditMaterialPage({
  params,
}: PageProps<"/materials/[materialId]/edit">) {
  const { materialId } = await params;
  return <MaterialForm key={materialId} materialId={materialId} />;
}
