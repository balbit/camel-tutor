FROM ocaml/opam:alpine-ocaml-5.2

# Initialize opam and set up the environment
RUN opam init -y --bare && \
    eval $(opam env) && \
    opam switch create 5.2.0 && \
    eval $(opam env) && \
    opam install -y core core_bench utop

# Set up the .ocamlinit file for the `utop` interactive environment
RUN echo '#require "core.top";;\n#require "ppx_jane";;\nopen Base;;' > ~/.ocamlinit

# Default command to run when starting the container
CMD ["utop"]
