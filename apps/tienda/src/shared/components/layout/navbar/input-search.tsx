import SearchAutocomplete from "@/features/search/components/search-autocomplete";

type InputSearchProps = {
	placeholder?: string;
	className?: string;
};

export default function InputSearch({
	placeholder = "Buscar productos...",
	className,
}: InputSearchProps) {
	return <SearchAutocomplete placeholder={placeholder} className={className} />;
}
