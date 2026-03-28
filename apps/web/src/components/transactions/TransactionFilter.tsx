import React, { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Filter, Search, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

interface TransactionFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

interface FilterState {
  search: string;
  types: string[];
  statuses: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

const emptyDateRange: FilterState["dateRange"] = {
  from: undefined,
  to: undefined,
};

export const TransactionFilter = ({ onFilterChange }: TransactionFilterProps) => {
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<FilterState["dateRange"]>(emptyDateRange);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const typeOptions = ["Deposit", "Withdrawal", "Transfer"];
  const statusOptions = ["completed", "pending"];

  const updateActiveFilters = () => {
    const active: string[] = [];

    if (types.length > 0) {
      active.push("Type");
    }

    if (statuses.length > 0) {
      active.push("Status");
    }

    if (dateRange.from || dateRange.to) {
      active.push("Date");
    }

    setActiveFilters(active);
  };

  const updateFilters = (filters: FilterState) => {
    onFilterChange(filters);
    updateActiveFilters();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);
    updateFilters({ search: value, types, statuses, dateRange });
  };

  const handleTypeToggle = (type: string) => {
    const nextTypes = types.includes(type)
      ? types.filter((value) => value !== type)
      : [...types, type];

    setTypes(nextTypes);
    updateFilters({ search, types: nextTypes, statuses, dateRange });
    updateActiveFilters();
  };

  const handleStatusToggle = (status: string) => {
    const nextStatuses = statuses.includes(status)
      ? statuses.filter((value) => value !== status)
      : [...statuses, status];

    setStatuses(nextStatuses);
    updateFilters({ search, types, statuses: nextStatuses, dateRange });
    updateActiveFilters();
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    const nextDateRange: FilterState["dateRange"] = {
      from: range?.from,
      to: range?.to,
    };

    setDateRange(nextDateRange);
    updateFilters({ search, types, statuses, dateRange: nextDateRange });
    updateActiveFilters();
  };

  const clearFilter = (filter: string) => {
    if (filter === "Type") {
      setTypes([]);
      updateFilters({ search, types: [], statuses, dateRange });
    } else if (filter === "Status") {
      setStatuses([]);
      updateFilters({ search, types, statuses: [], dateRange });
    } else if (filter === "Date") {
      setDateRange(emptyDateRange);
      updateFilters({ search, types, statuses, dateRange: emptyDateRange });
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypes([]);
    setStatuses([]);
    setDateRange(emptyDateRange);
    updateFilters({
      search: "",
      types: [],
      statuses: [],
      dateRange: emptyDateRange,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Type
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Transaction Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {typeOptions.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={types.includes(type)}
                onCheckedChange={() => handleTypeToggle(type)}
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Transaction Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statusOptions.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={statuses.includes(status)}
                onCheckedChange={() => handleStatusToggle(status)}
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Date Range
              {dateRange.from && (
                <span className="hidden md:inline-flex">: {format(dateRange.from, "MMM d")}</span>
              )}
              {dateRange.to && dateRange.from && (
                <span className="hidden md:inline-flex"> - {format(dateRange.to, "MMM d")}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>

        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-500 hover:bg-red-100 hover:text-red-700"
          >
            Clear all
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter}
              variant="outline"
              className="flex items-center gap-1 px-3 py-1"
            >
              {filter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter(filter)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
