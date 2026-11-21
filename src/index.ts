import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUiCapability, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { type Env, type State, type Props } from './types';
import { ResponseProcessor } from './utils';
import OAuthProvider from "./oauth-provider";
import { DefaultHandler } from "./default-handler";
import {
  checkSubjectBinding,
  ensureUserAccount,
} from './utils/vaultManager';
// import * as algosdk from 'algosdk';
import {
	registerAccountTools,
	registerGeneralTransactionTools,
	registerAssetTransactionTools,
	// registerAppTransactionTools,
	registerGroupTransactionTools,
	registerUtilityTools,
	registerAlgodTools,
	registerArc90Tools,
	registerReceiptTools,
	registerApiTools,
	// registerKnowledgeTools,
	registerWalletTools,
	registerAp2Tools,
	registerAlphaArcadeTools,
	registerX402Tools,
	// registerTinymanTools
} from './tools';
import { registerSkillResource } from './resources';



// Define our MCP agent with tools
// The Durable Object class behind PENDING_LOGINS must be exported from the main module
export { PendingLogins } from "./pending-logins";

// agents 0.8 requires the Env to fit the generated Cloudflare.Env (worker-configuration.d.ts)
export class AlgorandRemoteMCPLite extends McpAgent<Env & Cloudflare.Env, State, Props> {
	server = new McpServer({
		name: "Algorand Remote MCP Lite",
		version: "1.9.5",
		description: "Algorand Remote MCP Lite (aka Wallet Edition) for interacting with the Algorand blockchain. Use algorand_mcp_skill tool at start of each session to learn how to interact and operate Algorand Remote MCP Lite, or algorand_demo_skill tool for a guided, gamified demo.",
		websiteUrl: "https://goplausible.com",
		icons: [{
			src: "https://goplausible.com/favicon.ico",
			mimeType: "image/x-icon",
			sizes: ["64x64"]
		}]
	});

	// Initialize state with default values
	initialState: State = {
		items_per_page: 10

	};

	// Initialization function that sets up tools and resources
	async init() {
		// Configure ResponseProcessor with pagination settings
		console.log("Initializing Algorand Remote MCP...");
		console.log("Current state:", this.state);
		console.log("Props name:", this.props?.name);
		// Set provider in state if available in props
	
		console.log("Props User ID:", this.props?.id);
		console.log("Props clientId:", this.props?.clientId);
		// Set default page size or use from state if available
		const itemsPerPage = this.state?.items_per_page || 10;
		ResponseProcessor.setItemsPerPage(itemsPerPage);
		// Ensure user has a vault-based account
		const props = this.props;
		try {
			if (!props?.email || !props?.provider) {
				throw new Error('Email and provider must be provided in props');
			}
			// Every tool uses the account named by these props, and none is registered until this check
			// passes: the account must belong to this provider user (a recycled email or X handle must
			// not inherit someone else's wallet)
			const subjectProblem = await checkSubjectBinding(this.env, props.provider, props.email, props.id);
			if (subjectProblem) {
				throw new Error(subjectProblem);
			}
			const accType = await ensureUserAccount(this.env, props.email, props.provider, props.id);
			console.log(`User has a ${accType}-based account on the ${props.provider} provider`);
		} catch (error: any) {
			throw new Error(`Failed to ensure user account: ${error.message || 'Unknown error'}`);
		}

		// Set up UI capability detection
		this.server.server.oninitialized = () => {
			const caps = this.server.server.getClientCapabilities();
			const uiCap = getUiCapability(caps as any);
			const hasUi = !!uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE);
			console.log(`[MCP] Client UI capable: ${hasUi}`);
		};

		// Register resources
		// this.registerKnowledgeResources();
		this.registerSkillResources();

		// Register tools by category
		await this.registerWalletTools();
		await this.registerAp2Tools();
		// this.registerKnowledgeTools();
		this.registerArc90Tools();
		this.registerReceiptTools();
		this.registerAlgodTools();
		this.registerApiTools();
		this.registerAccountTools();
		await this.registerTransactionTools();
		this.registerBasicUtilityTools();
		this.registerAlphaArcadeTools();
		await this.registerX402Tools();
		// await this.registerTinymanTools()
		// Additional tool categories will be added here
	}


	// /**
	//  * Register knowledge resources
	//  */
	// private registerKnowledgeResources() {
	// 	// Register knowledge resources for documentation access
	// 	// Pass environment for R2 bucket access
	// 	registerKnowledgeResources(this.server, this.env, this.props);
	// }

	/**
	 * Register skill resources
	 */
	private registerSkillResources() {
		// Register skill resources for agent usage guidance
		registerSkillResource(this.server, this.env, this.props!);
	}

	/**
	 * Register basic utility tools
	 */
	private registerBasicUtilityTools() {
		// Register Algorand utility tools
		registerUtilityTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	/**
	 * Register account management tools
	 */
	private registerAccountTools() {
		// Register all account-related tools
		registerAccountTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	/**
	 * Register transaction management tools
	 */
	private async registerTransactionTools() {
		// Register payment transaction tools
		await registerGeneralTransactionTools(this.server, this.env, this.props!, this.env.ASSETS);

		// Register asset transaction tools
		registerAssetTransactionTools(this.server, this.env, this.props!, this.env.ASSETS);

		// Register application transaction tools
		// registerAppTransactionTools(this.server, this.env, this.props);

		// Register group transaction tools
		registerGroupTransactionTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	/**
	 * Register Algorand node interaction tools
	 */
	private registerAlgodTools() {
		// Register algod tools for TEAL compilation and simulation
		registerAlgodTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	/**
	 * Register ARC-90 URI generation tools
	 */
	private registerArc90Tools() {
		// Register ARC-90 URI generation tools
		registerArc90Tools(this.server, this.env, this.props!, this.env.ASSETS);
	}
	/**
	 * Register Receipt URI generation tools
	 */
	private registerReceiptTools() {
		// Register receipt tools
		registerReceiptTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	/**
	 * Register API integration tools
	 */
	private registerApiTools() {
		// Register external API integration tools (pass ASSETS for widget UI)
		registerApiTools(this.server, this.env, this.props!, this.env.ASSETS);
	}

	// /**
	//  * Register Knowledge tools for documentation access
	//  */
	// private registerKnowledgeTools() {
	// 	// Register knowledge documentation tools
	// 	registerKnowledgeTools(this.server, this.env, this.props);
	// }

	/**
	 * Register Wallet tools for wallet information access
	 */
	private async registerWalletTools() {
		// Register wallet management tools (pass ASSETS for widget UI)
		await registerWalletTools(this.server, this.env, this.props!, this.env.ASSETS);
	}
	/**
	 * Register AP2 tools 
	 */
	private async registerAp2Tools() {
		// Register AP2 mandate tools
		await registerAp2Tools(this.server, this.env, this.props!, this.env.ASSETS);
	}
	/**
	 * Register Wallet tools for wallet information access
	 */
	/**
	 * Register Alpha Arcade prediction market tools
	 */
	private registerAlphaArcadeTools() {
		registerAlphaArcadeTools(this.server, this.env, this.props!, this.env.ASSETS);
	}
	/**
	 * Register x402 payment protocol tools (discovery, paid requests, Bazaar)
	 */
	private async registerX402Tools() {
		await registerX402Tools(this.server, this.env, this.props!, this.env.ASSETS);
	}
	// private async registerTinymanTools() {
	// 	// Register wallet management tools
	// 	await registerTinymanTools(this.server, this.env, this.props);
	// }
	onStateUpdate(state: State) {
		// console.log({ stateUpdate: state });
	}
}
// export default AlgorandRemoteMCPLite.mount("/sse", {
//   binding: "AlgorandRemoteMCPLite",
// });

// export default {
// 	 fetch(request: Request, env: Env, ctx: ExecutionContext) {
// 		const url = new URL(request.url);
// 		console.log("Request URL:", url.pathname);
// 		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
// 			console.log("Serving SSE endpoint");



// 			return AlgorandRemoteMCPLite.serveSSE("/sse", {
// 				binding: "AlgorandRemoteMCPLite",
// 				// corsOptions: {
// 				// 	origin: "*",
// 				// 	methods: "GET, POST, OPTIONS",
// 				// 	headers: "Content-Type, Authorization",
// 				// 	maxAge: 3600,
// 				// },	
// 			}).fetch(request, env, ctx); // Use our custom environment
// 		}

// 		if (url.pathname === "/mcp") {
// 			console.log("Serving MCP endpoint");

// 			return AlgorandRemoteMCPLite.serve("/mcp", {
// 				binding: "AlgorandRemoteMCPLite"
// 			}).fetch(request, env, ctx); // Use our custom environment
// 		}

// 		return new Response("Not found", { status: 404 });
// 	},
// };

/**
 * Grants created before this time are refused at refresh and deleted. One cutoff for the whole dOAuth
 * protocol (decision D3, 2026-11-20): the same date in all three servers that share the token store,
 * just after algorand-remote-mcp's login fix went live (ae36536, deployed 2026-11-20 16:34:26 UTC),
 * with half a minute for the rollout. Not exported: named exports of the main module must be
 * classes or handlers.
 */
const GRANTS_ISSUED_BEFORE = Math.floor(Date.parse("2026-11-20T16:35:00Z") / 1000);

export default new OAuthProvider({
	apiHandler: AlgorandRemoteMCPLite.mount("/sse", {
		binding: "AlgorandRemoteMCPLite"
	}) as any,
	apiRoute: "/sse",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: DefaultHandler as any,
	tokenEndpoint: "/token",
	grantsIssuedBefore: GRANTS_ISSUED_BEFORE,
	// This server has always added the client ID to the client redirect when a state is present
	clientRedirectParams: (_props, request) => ({
		client: request.state ? request.clientId : undefined,
	}),
});

