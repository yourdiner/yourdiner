"use client";

import { useState } from "react";
import { useServerSyncedState } from "@/hooks/use-server-synced-state";
import { useRouter } from "next/navigation";
import { createCategory, deleteCategory, reorderCategories } from "@/lib/menu-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  _count: { products: number };
}

function SortableCategory({
  category,
  onDelete,
}: {
  category: Category;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-4"
    >
      <button {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1">
        <p className="font-medium">{category.name}</p>
        <p className="text-sm text-muted-foreground">
          {category._count.products} products
          {category.isHidden && " • Hidden"}
        </p>
      </div>
      <Badge variant={category.isActive ? "success" : "secondary"}>
        {category.isActive ? "Active" : "Inactive"}
      </Badge>
      <Button variant="ghost" size="icon" onClick={() => onDelete(category.id)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function CategoriesManager({ categories: initial }: { categories: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useServerSyncedState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createCategory({ name, description });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Category created");
      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const result = await deleteCategory(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);

    const result = await reorderCategories(
      reordered.map((c, i) => ({ id: c.id, sortOrder: i }))
    );
    if (!result.ok) {
      toast.error(result.error);
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <RequiredLabel>Name</RequiredLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <RequiredLabel required={false}>Description</RequiredLabel>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {categories.map((category) => (
              <SortableCategory key={category.id} category={category} onDelete={handleDelete} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No categories yet</p>
      )}
    </div>
  );
}
