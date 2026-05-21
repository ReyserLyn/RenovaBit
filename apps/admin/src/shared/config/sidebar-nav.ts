import {
	Chart01Icon,
	CouponPercentIcon,
	DashboardSquare01Icon,
	DeliveryBox01Icon,
	Settings01Icon,
	ShoppingCartCheck02Icon,
	StarIcon,
	UserMultiple02Icon,
} from "@hugeicons/core-free-icons";

export const sidebarNavigation = {
	main: [
		{ name: "Resumen", url: "/", icon: DashboardSquare01Icon },
		{ name: "Pedidos", url: "/pedidos", icon: ShoppingCartCheck02Icon },
		{ name: "Productos", url: "/productos", icon: DeliveryBox01Icon },
		{ name: "Clientes", url: "/clientes", icon: UserMultiple02Icon },
		{ name: "Cupones", url: "/cupones", icon: CouponPercentIcon },
		{ name: "Ventas e informes", url: "/reportes", icon: Chart01Icon },
	],
	sections: [
		{
			title: "Catálogo",
			url: "/productos",
			icon: DeliveryBox01Icon,
			items: [
				{ title: "Productos", url: "/productos" },
				{ title: "Categorías", url: "/categorias" },
				{ title: "Marcas", url: "/marcas" },
				{ title: "SKUs bloqueados", url: "/lista-negra" },
			],
		},
		{
			title: "Ventas",
			url: "/pedidos",
			icon: ShoppingCartCheck02Icon,
			items: [
				{ title: "Pedidos", url: "/pedidos" },
				{ title: "Proformas", url: "/proformas" },
				{ title: "Transacciones", url: "/transacciones" },
			],
		},
		{
			title: "Marketing",
			url: "/cupones",
			icon: CouponPercentIcon,
			items: [
				{ title: "Cupones", url: "/cupones" },
				{ title: "Ofertas", url: "/ofertas" },
			],
		},
		{
			title: "Contenido",
			url: "/productos-destacados",
			icon: StarIcon,
			items: [{ title: "Productos destacados", url: "/productos-destacados" }],
		},
		{
			title: "Actividad",
			url: "/historial",
			icon: Chart01Icon,
			items: [
				{ title: "Historial de cambios", url: "/historial" },
				{ title: "Notificaciones", url: "/notificaciones" },
			],
		},
		{
			title: "Configuración",
			url: "/configuracion",
			icon: Settings01Icon,
			items: [
				{ title: "General", url: "/configuracion" },
				{ title: "Usuarios", url: "/usuarios" },
			],
		},
	],
} as const;

export type SidebarMainItem = (typeof sidebarNavigation.main)[number];
export type SidebarSection = (typeof sidebarNavigation.sections)[number];
export type SidebarSubLink = SidebarSection["items"][number];
