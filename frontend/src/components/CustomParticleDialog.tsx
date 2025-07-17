import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomParticleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddParticle: (particle: string) => void;
}

export function CustomParticleDialog({ isOpen, onClose, onAddParticle }: CustomParticleDialogProps) {
  const [particle, setParticle] = useState("");

  const handleSubmit = () => {
    if (particle.trim()) {
      onAddParticle(particle.trim());
      setParticle("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Custom Particle</DialogTitle>
          <DialogDescription>
            Enter a custom particle to add to the list of available particles.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="particle" className="text-right">
              Particle
            </Label>
            <Input
              id="particle"
              value={particle}
              onChange={(e) => setParticle(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>Add Particle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}