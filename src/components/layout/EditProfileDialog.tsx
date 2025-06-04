
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name cannot be empty.").max(50, "Name is too long."),
  email: z.string().email("Invalid email address.").max(100, "Email is too long."),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface EditProfileDialogProps {
  currentName: string;
  currentEmail: string;
  onSave: (data: ProfileFormValues) => void;
}

export function EditProfileDialog({ currentName, currentEmail, onSave }: EditProfileDialogProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    // Default values are set via useEffect to ensure they update if props change while dialog is mounted
  });

  useEffect(() => {
    form.reset({
      name: currentName,
      email: currentEmail,
    });
  }, [currentName, currentEmail, form]);

  const onSubmit = (data: ProfileFormValues) => {
    onSave(data);
    // DialogClose will be handled by the button if onSave leads to closing the dialog
  };

  return (
    <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground shadow-xl rounded-lg">
      <DialogHeader>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogDescription>
          Make changes to your profile here. Click save when you&apos;re done.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="your.email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            {/* For the save button, DialogClose is not explicitly needed here if onSave also closes the dialog */}
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
