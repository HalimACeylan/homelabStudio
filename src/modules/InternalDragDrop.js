/**
 * Internal Drag and Drop - Handles dragging apps and OS environments within and between nodes
 */

export class InternalDragDrop {
  constructor(app) {
    this.app = app;
    this.draggedItem = null;
    this.draggedFrom = null; // { nodeId, osEnvId, index }
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Use event delegation on the canvas
    const canvas = document.getElementById("canvas-container");

    canvas.addEventListener("dragstart", (e) => this.handleDragStart(e));
    canvas.addEventListener("dragend", (e) => this.handleDragEnd(e));
    canvas.addEventListener("dragover", (e) => this.handleDragOver(e));
    canvas.addEventListener("drop", (e) => this.handleDrop(e));
    canvas.addEventListener("dragleave", (e) => this.handleDragLeave(e));
  }

  handleDragStart(e) {
    const appItem = e.target.closest(".node-app-item");
    const osEnvHeader = e.target.closest(".os-env-header");

    if (appItem) {
      e.stopPropagation(); // Prevent node dragging

      const appType = appItem.dataset.app;
      const nodeElement = appItem.closest(".canvas-node");
      const osEnvElement = appItem.closest(".os-env-group");

      if (nodeElement) {
        this.draggedItem = {
          type: "application",
          appType: appType,
          nodeId: nodeElement.dataset.nodeId,
          osEnvId: osEnvElement?.dataset.osEnvId || null,
        };

        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(this.draggedItem));
        appItem.classList.add("dragging");
      }
    } else if (osEnvHeader) {
      e.stopPropagation(); // Prevent node dragging

      const osEnvElement = osEnvHeader.closest(".os-env-group");
      const nodeElement = osEnvElement.closest(".canvas-node");
      const parentOsEnv = osEnvElement.parentElement.closest(".os-env-group");

      if (osEnvElement && nodeElement) {
        this.draggedItem = {
          type: "os-environment",
          osEnvId: osEnvElement.dataset.osEnvId,
          nodeId: nodeElement.dataset.nodeId,
          parentOsEnvId: parentOsEnv?.dataset.osEnvId || null,
        };

        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(this.draggedItem));
        osEnvElement.classList.add("dragging");
      }
    }
  }

  handleDragEnd(e) {
    // Clean up dragging state
    document.querySelectorAll(".dragging").forEach((el) => {
      el.classList.remove("dragging");
    });
    document.querySelectorAll(".drop-target-active").forEach((el) => {
      el.classList.remove("drop-target-active");
    });

    this.draggedItem = null;
  }

  handleDragOver(e) {
    if (!this.draggedItem) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Find drop target
    const dropZone = e.target.closest(".app-drop-zone");
    const nodeAppsContainer = e.target.closest(".node-apps-container");

    if (dropZone) {
      dropZone.classList.add("drop-target-active");
    } else if (nodeAppsContainer) {
      nodeAppsContainer.classList.add("drop-target-active");
    }
  }

  handleDragLeave(e) {
    const dropZone = e.target.closest(".app-drop-zone");
    const nodeAppsContainer = e.target.closest(".node-apps-container");

    if (dropZone && !dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove("drop-target-active");
    } else if (
      nodeAppsContainer &&
      !nodeAppsContainer.contains(e.relatedTarget)
    ) {
      nodeAppsContainer.classList.remove("drop-target-active");
    }
  }

  handleDrop(e) {
    // Only handle if this is an internal drag
    if (!this.draggedItem) {
      // Not an internal drag - let other handlers (PaletteController) handle it
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Remove drop target highlighting
    document.querySelectorAll(".drop-target-active").forEach((el) => {
      el.classList.remove("drop-target-active");
    });

    const dropZone = e.target.closest(".app-drop-zone");
    const nodeAppsContainer = e.target.closest(".node-apps-container");
    const nodeElement = e.target.closest(".canvas-node");

    if (!nodeElement) return;

    const targetNodeId = nodeElement.dataset.nodeId;

    if (this.draggedItem.type === "application") {
      this.handleApplicationDrop(dropZone, nodeAppsContainer, targetNodeId);
    } else if (this.draggedItem.type === "os-environment") {
      this.handleOSEnvironmentDrop(dropZone, nodeAppsContainer, targetNodeId);
    }
  }

  handleApplicationDrop(dropZone, nodeAppsContainer, targetNodeId) {
    const {
      appType,
      nodeId: sourceNodeId,
      osEnvId: sourceOsEnvId,
    } = this.draggedItem;

    let targetOsEnvId = null;

    // Determine target OS environment
    if (dropZone) {
      targetOsEnvId = dropZone.dataset.osEnvId || null;
    }

    // Case 1: Moving within same node and same OS environment - just reordering
    if (targetNodeId === sourceNodeId && targetOsEnvId === sourceOsEnvId) {
      // Reordering not implemented yet - would need position tracking
      return;
    }

    // Case 2: Moving to different location
    // Remove from source
    const success = this.app.diagram.removeApplicationFromNode(
      sourceNodeId,
      appType,
      sourceOsEnvId
    );

    if (success) {
      // Add to target
      const added = this.app.diagram.addApplicationToNode(
        targetNodeId,
        appType,
        targetOsEnvId
      );

      if (added) {
        // Update both nodes
        const sourceNode = this.app.diagram.nodes.get(sourceNodeId);
        const targetNode = this.app.diagram.nodes.get(targetNodeId);

        if (sourceNode) {
          this.app.nodeRenderer.updateNodeElement(sourceNodeId, sourceNode);
        }
        if (targetNode && targetNodeId !== sourceNodeId) {
          this.app.nodeRenderer.updateNodeElement(targetNodeId, targetNode);
        }

        const targetLocation = targetOsEnvId ? "OS environment" : "server";
        this.app.ui.showToast(
          `Moved ${appType} to ${targetLocation}`,
          "success"
        );
      }
    }
  }

  handleOSEnvironmentDrop(dropZone, nodeAppsContainer, targetNodeId) {
    const {
      osEnvId,
      nodeId: sourceNodeId,
      parentOsEnvId: sourceParentId,
    } = this.draggedItem;

    let targetParentId = null;

    // Determine target parent
    if (dropZone) {
      targetParentId = dropZone.dataset.osEnvId || null;
    }

    // Can't drop an OS environment into itself
    if (osEnvId === targetParentId) {
      return;
    }

    // Case 1: Moving within same node and same parent - just reordering
    if (targetNodeId === sourceNodeId && targetParentId === sourceParentId) {
      // Reordering not implemented yet
      return;
    }

    // Case 2: Moving to different location
    const success = this.app.diagram.moveOSEnvironment(
      sourceNodeId,
      osEnvId,
      targetNodeId,
      targetParentId
    );

    if (success) {
      const sourceNode = this.app.diagram.nodes.get(sourceNodeId);
      const targetNode = this.app.diagram.nodes.get(targetNodeId);

      if (sourceNode) {
        this.app.nodeRenderer.updateNodeElement(sourceNodeId, sourceNode);
      }
      if (targetNode && targetNodeId !== sourceNodeId) {
        this.app.nodeRenderer.updateNodeElement(targetNodeId, targetNode);
      }

      this.app.ui.showToast("Moved OS environment", "success");
    }
  }
}
