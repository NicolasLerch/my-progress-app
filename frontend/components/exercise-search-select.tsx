'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { ExerciseDTO } from '@my-progress/shared'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type ExerciseSearchSelectProps = {
  value: string
  selectedExercise?: Pick<ExerciseDTO, 'id' | 'name' | 'muscleGroup'>
  onSelect: (exercise: ExerciseDTO) => void
  searchExercises: (query: string) => Promise<ExerciseDTO[]>
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
}

export function ExerciseSearchSelect({
  value,
  selectedExercise,
  onSelect,
  searchExercises,
  placeholder = 'Selecciona un ejercicio',
  searchPlaceholder = 'Buscar por ejercicio o grupo muscular',
  emptyMessage = 'No se encontraron ejercicios.',
  disabled = false,
}: ExerciseSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ExerciseDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const items = await searchExercises(query.trim())
        if (!cancelled) {
          setResults(items)
        }
      } catch (cause) {
        if (!cancelled) {
          setResults([])
          setError(cause instanceof Error ? cause.message : 'No se pudo buscar ejercicios.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [open, query, searchExercises])

  const visibleResults = useMemo(() => {
    if (!selectedExercise || results.some((item) => item.id === selectedExercise.id)) {
      return results
    }

    return [selectedExercise, ...results]
  }, [results, selectedExercise])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery('')
          setError(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className="truncate text-left">
            {selectedExercise?.name ? `${selectedExercise.name}${selectedExercise.muscleGroup ? ` - ${selectedExercise.muscleGroup}` : ''}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando ejercicios...</div>
            ) : error ? (
              <div className="px-3 py-6 text-center text-sm text-destructive">{error}</div>
            ) : visibleResults.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup heading={query.trim() ? 'Resultados' : 'Sugeridos'}>
                {visibleResults.map((exercise) => (
                  <CommandItem
                    key={exercise.id}
                    value={`${exercise.name} ${exercise.muscleGroup}`}
                    onSelect={() => {
                      onSelect(exercise)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <Check className={cn('size-4', value === exercise.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{exercise.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{exercise.muscleGroup}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
